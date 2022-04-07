// SPDX-License-Identifier: Unlicense
pragma solidity >=0.8.0;

import {ERC20} from "solmate/tokens/ERC20.sol";

interface IFusePool {
    function cTokensByUnderlying(address) external returns (address);
}

interface IFToken {
    function isCEther() external returns (bool);

    function mint(uint256) external returns (uint256);
}

/// @title Fuse Pool Zap
/// @author LI.FI (https://li.fi)
/// @notice Allows anyone to quickly zap into a Rari Fuse Pool
contract FusePoolZap {
    /// Errors ///

    error InvalidPoolAddress(address);
    error InvalidSupplyToken(address);
    error InvalidAmount(uint256);
    error CannotDepositNativeToken();
    error MintingError(bytes);

    /// Events ///

    event ZappedIn(address indexed pool, address fToken, uint256 amount);

    /// Public Methods ///

    /// @notice Given a supply token receive an fToken from a given Fuse pool
    /// @param _pool Rari Fuse Pool contract address
    /// @param _supplyToken the token to supply to the pool
    /// @param _amount Amount of _supplyToken to supply
    function zapIn(
        address _pool,
        address _supplyToken,
        uint256 _amount
    ) external payable {
        if (_pool == address(0)) {
            revert InvalidPoolAddress(_pool);
        }

        if (_amount <= 0) {
            revert InvalidAmount(_amount);
        }

        if (_supplyToken == address(0) && _amount != msg.value) {
            revert InvalidAmount(msg.value);
        }

        IFToken fToken = IFToken(
            IFusePool(_pool).cTokensByUnderlying(_supplyToken)
        );

        if (address(fToken) == address(0)) {
            revert InvalidSupplyToken(_supplyToken);
        }

        uint256 preMintBalance = ERC20(address(fToken)).balanceOf(
            address(this)
        );

        uint256 mintAmount;
        if (_supplyToken == address(0)) {
            if (!fToken.isCEther()) revert CannotDepositNativeToken();
            // Use call because method can succeed with partial revert
            (bool success, bytes memory res) = address(fToken).call{
                value: msg.value
            }(abi.encodeWithSignature("mint()"));
            mintAmount = ERC20(address(fToken)).balanceOf(address(this));
            if (!success && mintAmount == 0) {
                revert MintingError(res);
            }
        } else {
            ERC20(_supplyToken).transferFrom(
                msg.sender,
                address(this),
                _amount
            );
            ERC20(_supplyToken).approve(address(fToken), _amount);
            fToken.mint(_amount);
            mintAmount = ERC20(address(fToken)).balanceOf(address(this));
        }

        mintAmount = mintAmount - preMintBalance;

        ERC20(address(fToken)).transfer(msg.sender, mintAmount);

        emit ZappedIn(_pool, address(fToken), mintAmount);
    }
}
