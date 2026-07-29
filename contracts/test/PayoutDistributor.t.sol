// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {PayoutDistributor} from "../src/PayoutDistributor.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract PayoutDistributorTest is Test {
    PayoutDistributor internal distributor;
    MockUSDC internal usdc;

    address internal admin = makeAddr("admin");
    address internal treasury = makeAddr("treasury");
    address internal operator = makeAddr("operator");
    address internal approver = makeAddr("approver");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    bytes32 internal constant BATCH_ID = keccak256("batch-1");

    function setUp() public {
        usdc = new MockUSDC();
        distributor = new PayoutDistributor(admin, treasury);

        vm.startPrank(admin);
        distributor.grantRole(distributor.OPERATOR_ROLE(), operator);
        distributor.grantRole(distributor.APPROVER_ROLE(), approver);
        vm.stopPrank();

        usdc.mint(treasury, 1_000_000e6);
        vm.prank(treasury);
        usdc.approve(address(distributor), type(uint256).max);
    }

    function _payload() internal view returns (address[] memory recipients, uint256[] memory amounts) {
        recipients = new address[](2);
        amounts = new uint256[](2);
        recipients[0] = alice;
        recipients[1] = bob;
        amounts[0] = 250e6;
        amounts[1] = 750e6;
    }

    function _submit() internal returns (address[] memory recipients, uint256[] memory amounts) {
        (recipients, amounts) = _payload();
        bytes32 payloadHash = distributor.hashPayload(address(usdc), recipients, amounts);
        vm.prank(operator);
        distributor.submitBatch(BATCH_ID, address(usdc), 1_000e6, 2, payloadHash);
    }

    function test_happyPath() public {
        (address[] memory recipients, uint256[] memory amounts) = _submit();

        vm.prank(approver);
        distributor.approveBatch(BATCH_ID);

        vm.prank(operator);
        distributor.executeBatch(BATCH_ID, recipients, amounts);

        assertEq(usdc.balanceOf(alice), 250e6);
        assertEq(usdc.balanceOf(bob), 750e6);
        assertEq(usdc.balanceOf(treasury), 999_000e6);
        assertEq(uint8(distributor.getBatch(BATCH_ID).status), uint8(PayoutDistributor.BatchStatus.Executed));
    }

    function test_cannotExecuteWithoutApproval() public {
        (address[] memory recipients, uint256[] memory amounts) = _submit();

        vm.expectRevert(abi.encodeWithSelector(PayoutDistributor.BatchNotApproved.selector, BATCH_ID));
        vm.prank(operator);
        distributor.executeBatch(BATCH_ID, recipients, amounts);
    }

    function test_makerCannotApproveOwnBatch() public {
        _submit();
        bytes32 approverRole = distributor.APPROVER_ROLE();
        vm.prank(admin);
        distributor.grantRole(approverRole, operator);

        vm.expectRevert(PayoutDistributor.SelfApprovalForbidden.selector);
        vm.prank(operator);
        distributor.approveBatch(BATCH_ID);
    }

    function test_cannotExecuteTwice() public {
        (address[] memory recipients, uint256[] memory amounts) = _submit();
        vm.prank(approver);
        distributor.approveBatch(BATCH_ID);

        vm.startPrank(operator);
        distributor.executeBatch(BATCH_ID, recipients, amounts);
        vm.expectRevert(abi.encodeWithSelector(PayoutDistributor.BatchNotApproved.selector, BATCH_ID));
        distributor.executeBatch(BATCH_ID, recipients, amounts);
        vm.stopPrank();
    }

    function test_tamperedPayloadReverts() public {
        (address[] memory recipients, uint256[] memory amounts) = _submit();
        vm.prank(approver);
        distributor.approveBatch(BATCH_ID);

        amounts[1] = 900e6;
        vm.expectRevert(abi.encodeWithSelector(PayoutDistributor.PayloadMismatch.selector, BATCH_ID));
        vm.prank(operator);
        distributor.executeBatch(BATCH_ID, recipients, amounts);
    }

    function test_duplicateBatchIdReverts() public {
        _submit();
        (address[] memory recipients, uint256[] memory amounts) = _payload();
        bytes32 payloadHash = distributor.hashPayload(address(usdc), recipients, amounts);

        vm.expectRevert(abi.encodeWithSelector(PayoutDistributor.BatchExists.selector, BATCH_ID));
        vm.prank(operator);
        distributor.submitBatch(BATCH_ID, address(usdc), 1_000e6, 2, payloadHash);
    }

    function test_cancelBlocksExecution() public {
        (address[] memory recipients, uint256[] memory amounts) = _submit();
        vm.prank(operator);
        distributor.cancelBatch(BATCH_ID);

        vm.expectRevert(abi.encodeWithSelector(PayoutDistributor.BatchNotApproved.selector, BATCH_ID));
        vm.prank(operator);
        distributor.executeBatch(BATCH_ID, recipients, amounts);
    }

    function test_pauseBlocksSubmit() public {
        vm.prank(admin);
        distributor.pause();

        (address[] memory recipients, uint256[] memory amounts) = _payload();
        bytes32 payloadHash = distributor.hashPayload(address(usdc), recipients, amounts);

        vm.expectRevert(Pausable.EnforcedPause.selector);
        vm.prank(operator);
        distributor.submitBatch(BATCH_ID, address(usdc), 1_000e6, 2, payloadHash);
    }

    function test_onlyOperatorCanSubmit() public {
        (address[] memory recipients, uint256[] memory amounts) = _payload();
        bytes32 payloadHash = distributor.hashPayload(address(usdc), recipients, amounts);

        bytes32 operatorRole = distributor.OPERATOR_ROLE();
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, alice, operatorRole)
        );
        vm.prank(alice);
        distributor.submitBatch(BATCH_ID, address(usdc), 1_000e6, 2, payloadHash);
    }

    function test_zeroAmountReverts() public {
        address[] memory recipients = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        recipients[0] = alice;
        amounts[0] = 0;

        bytes32 batchId = keccak256("batch-zero");
        bytes32 payloadHash = distributor.hashPayload(address(usdc), recipients, amounts);
        vm.prank(operator);
        distributor.submitBatch(batchId, address(usdc), 0, 1, payloadHash);
        vm.prank(approver);
        distributor.approveBatch(batchId);

        vm.expectRevert(abi.encodeWithSelector(PayoutDistributor.ZeroAmount.selector, 0));
        vm.prank(operator);
        distributor.executeBatch(batchId, recipients, amounts);
    }
}
