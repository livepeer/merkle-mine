pragma solidity ^0.4.24;


/**
 * @title BytesUtil
 * @dev Utilities for extracting bytes from byte arrays
 * Functions taken from:
 * - https://github.com/ethereum/solidity-examples/blob/master/src/unsafe/Memory.sol
 * - https://github.com/ethereum/solidity-examples/blob/master/src/bytes/Bytes.sol
 */
library BytesUtil{
    uint256 internal constant BYTES_HEADER_SIZE = 32;
    uint256 internal constant WORD_SIZE = 32;
    
    /**
     * @dev Returns a memory pointer to the data portion of the provided bytes array.
     * @param bts Memory byte array
     */
    function dataPtr(bytes memory bts) internal pure returns (uint256 addr) {
        assembly {
            addr := add(bts, /*BYTES_HEADER_SIZE*/ 32)
        }
    }
    
    /**
     * @dev Copy 'len' bytes from memory address 'src', to address 'dest'.
     * This function does not check the or destination, it only copies
     * the bytes.
     * @param src Memory address of source byte array
     * @param dest Memory address of destination byte array
     * @param len Number of bytes to copy from `src` to `dest`
     */
    function copy(uint256 src, uint256 dest, uint256 len) internal pure {
        // Copy word-length chunks while possible
        for (; len >= WORD_SIZE; len -= WORD_SIZE) {
            assembly {
                mstore(dest, mload(src))
            }
            dest += WORD_SIZE;
            src += WORD_SIZE;
        }

        // Copy remaining bytes
        uint256 mask = 256 ** (WORD_SIZE - len) - 1;
        assembly {
            let srcpart := and(mload(src), not(mask))
            let destpart := and(mload(dest), mask)
            mstore(dest, or(destpart, srcpart))
        }
    }

    /**
     * @dev Creates a 'bytes memory' variable from the memory address 'addr', with the
     * length 'len'. The function will allocate new memory for the bytes array, and
     * the 'len bytes starting at 'addr' will be copied into that new memory.
     * @param addr Memory address of input byte array
     * @param len Number of bytes to copy from input byte array
     */
    function toBytes(uint256 addr, uint256 len) internal pure returns (bytes memory bts) {
        bts = new bytes(len);
        uint256 btsptr = dataPtr(bts);
        copy(addr, btsptr, len);
    }
    
    /**
     * @dev Copies 'len' bytes from 'bts' into a new array, starting at the provided 'startIndex'.
     * Returns the new copy.
     * Requires that:
     *  - 'startIndex + len <= self.length'
     * The length of the substring is: 'len'
     * @param bts Memory byte array to copy from
     * @param startIndex Index of `bts` to start copying bytes from
     * @param len Number of bytes to copy from `bts`
     */
    function substr(bytes memory bts, uint256 startIndex, uint256 len) internal pure returns (bytes memory) {
        require(startIndex + len <= bts.length);
        if (len == 0) {
            return;
        }
        uint256 addr = dataPtr(bts);
        return toBytes(addr + startIndex, len);
    }

    /**
     * @dev Reads a bytes32 value from a byte array by copying 32 bytes from `bts` starting at the provided `startIndex`.
     * @param bts Memory byte array to copy from
     * @param startIndex Index of `bts` to start copying bytes from
     */
    function readBytes32(bytes memory bts, uint256 startIndex) internal pure returns (bytes32 result) {
        require(startIndex + 32 <= bts.length);

        uint256 addr = dataPtr(bts);

        assembly {
            result := mload(add(addr, startIndex))
        }

        return result;
    }
}