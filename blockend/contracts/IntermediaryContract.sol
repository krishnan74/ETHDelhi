// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IMorphoVault {
    function deposit(
        uint256 assets,
        address receiver
    ) external returns (uint256 shares);
}

contract IntermediaryContract is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    struct InvestmentPlan {
        address[] vaults;
        uint256[] amounts;
        address[] tokens;
        uint256 totalAmount;
        bool executed;
        uint256 deadline;
    }

    struct MemberContribution {
        address member;
        uint256 amount;
        bool contributed;
    }

    mapping(uint256 => InvestmentPlan) public investmentPlans;
    mapping(uint256 => MemberContribution[]) public planContributions;
    mapping(uint256 => mapping(address => bool)) public hasContributed;

    uint256 public planCounter;
    uint256 public constant CONTRIBUTION_DEADLINE = 24 hours;

    event InvestmentPlanCreated(
        uint256 indexed planId,
        address[] vaults,
        uint256[] amounts,
        address[] tokens,
        uint256 totalAmount
    );

    event ContributionReceived(
        uint256 indexed planId,
        address indexed member,
        uint256 amount,
        address token
    );

    event InvestmentExecuted(uint256 indexed planId, uint256 totalInvested);

    event PlanExpired(uint256 indexed planId);

    constructor() Ownable(msg.sender) {}

    /**
     * @dev Create a new investment plan
     */
    function createInvestmentPlan(
        address[] memory _vaults,
        uint256[] memory _amounts,
        address[] memory _tokens,
        address[] memory _members,
        uint256 _totalAmount
    ) external onlyOwner returns (uint256) {
        require(_vaults.length == _amounts.length, "Arrays length mismatch");
        require(
            _vaults.length == _tokens.length,
            "Token array length mismatch"
        );
        require(_totalAmount > 0, "Total amount must be greater than 0");

        uint256 planId = planCounter++;

        investmentPlans[planId] = InvestmentPlan({
            vaults: _vaults,
            amounts: _amounts,
            tokens: _tokens,
            totalAmount: _totalAmount,
            executed: false,
            deadline: block.timestamp + CONTRIBUTION_DEADLINE
        });

        // Initialize member contributions
        for (uint256 i = 0; i < _members.length; i++) {
            planContributions[planId].push(
                MemberContribution({
                    member: _members[i],
                    amount: _totalAmount / _members.length,
                    contributed: false
                })
            );
        }

        emit InvestmentPlanCreated(
            planId,
            _vaults,
            _amounts,
            _tokens,
            _totalAmount
        );
        return planId;
    }

    /**
     * @dev Contribute to an investment plan
     */
    function contributeToPlan(
        uint256 _planId,
        address _token,
        uint256 _amount
    ) external nonReentrant {
        require(_planId < planCounter, "Plan does not exist");
        require(!investmentPlans[_planId].executed, "Plan already executed");
        require(
            block.timestamp <= investmentPlans[_planId].deadline,
            "Contribution deadline passed"
        );
        require(!hasContributed[_planId][msg.sender], "Already contributed");

        // Find member contribution
        MemberContribution[] storage contributions = planContributions[_planId];
        bool memberFound = false;

        for (uint256 i = 0; i < contributions.length; i++) {
            if (contributions[i].member == msg.sender) {
                require(
                    _amount == contributions[i].amount,
                    "Incorrect contribution amount"
                );
                contributions[i].contributed = true;
                memberFound = true;
                break;
            }
        }

        require(memberFound, "Not a member of this plan");

        hasContributed[_planId][msg.sender] = true;

        // Transfer tokens from user
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        emit ContributionReceived(_planId, msg.sender, _amount, _token);
    }

    /**
     * @dev Execute investment plan after all contributions received
     */
    function executeInvestmentPlan(uint256 _planId) external onlyOwner {
        require(_planId < planCounter, "Plan does not exist");
        require(!investmentPlans[_planId].executed, "Plan already executed");
        require(
            block.timestamp <= investmentPlans[_planId].deadline,
            "Contribution deadline passed"
        );

        InvestmentPlan storage plan = investmentPlans[_planId];
        MemberContribution[] storage contributions = planContributions[_planId];

        // Check if all members have contributed
        for (uint256 i = 0; i < contributions.length; i++) {
            require(
                contributions[i].contributed,
                "Not all members have contributed"
            );
        }

        plan.executed = true;

        // Execute investments
        for (uint256 i = 0; i < plan.vaults.length; i++) {
            if (plan.amounts[i] > 0) {
                // Approve vault to spend tokens
                IERC20(plan.tokens[i]).approve(plan.vaults[i], plan.amounts[i]);

                // Deposit to vault
                IMorphoVault(plan.vaults[i]).deposit(
                    plan.amounts[i],
                    address(this)
                );
            }
        }

        emit InvestmentExecuted(_planId, plan.totalAmount);
    }

    /**
     * @dev Check if plan can be executed
     */
    function canExecutePlan(uint256 _planId) external view returns (bool) {
        if (_planId >= planCounter) return false;
        if (investmentPlans[_planId].executed) return false;
        if (block.timestamp > investmentPlans[_planId].deadline) return false;

        MemberContribution[] memory contributions = planContributions[_planId];
        for (uint256 i = 0; i < contributions.length; i++) {
            if (!contributions[i].contributed) return false;
        }
        return true;
    }

    /**
     * @dev Get plan details
     */
    function getPlanDetails(
        uint256 _planId
    )
        external
        view
        returns (
            address[] memory vaults,
            uint256[] memory amounts,
            address[] memory tokens,
            uint256 totalAmount,
            bool executed,
            uint256 deadline
        )
    {
        require(_planId < planCounter, "Plan does not exist");
        InvestmentPlan memory plan = investmentPlans[_planId];
        return (
            plan.vaults,
            plan.amounts,
            plan.tokens,
            plan.totalAmount,
            plan.executed,
            plan.deadline
        );
    }

    /**
     * @dev Get member contributions for a plan
     */
    function getPlanContributions(
        uint256 _planId
    ) external view returns (MemberContribution[] memory) {
        require(_planId < planCounter, "Plan does not exist");
        return planContributions[_planId];
    }

    /**
     * @dev Emergency function to withdraw tokens (only owner)
     */
    function emergencyWithdraw(
        address _token,
        uint256 _amount
    ) external onlyOwner {
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
