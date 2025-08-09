# NEAR Drops: Complete Tutorial - From Zero to Drop Contract

Ever wished you could send crypto to someone as easily as sharing a WiFi password? That's exactly what NEAR Drops do! Think of them as digital gift cards that you can send through a simple link – no complex wallet addresses, no confusing setup, just click and claim.

By the end of this tutorial, you'll not only understand NEAR Drops conceptually, but you'll have built and deployed your own drop contract from scratch. Let's dive in!

## What Are NEAR Drops?

Imagine you want to give your friend $10 in crypto, but they've never used a blockchain before. Instead of making them:
- Download a wallet app
- Write down a seed phrase  
- Figure out their wallet address
- Wait for you to send tokens

You can create a NEAR Drop – a magic link that contains the crypto. Your friend just clicks the link, and boom! They have the tokens in a new wallet that gets created automatically.

**Real-world analogy:** It's like those scratch-off gift cards at the store, except instead of scratching off a code, your friend just clicks a link.

## Understanding the Architecture

Before we build, let's understand what's happening under the hood:

### The Drop Contract Ecosystem

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Drop Creator  │    │  Drop Contract  │    │  Drop Claimer   │
│                 │    │                 │    │                 │
│ 1. Creates keys │───▶│ 2. Stores drops │◀───│ 3. Claims with  │
│ 2. Funds drop   │    │ 3. Validates    │    │    private key  │
│ 3. Shares link  │    │ 4. Distributes  │    │ 4. Gets tokens  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Key Components

1. **Access Keys**: Cryptographic key pairs that control access
2. **Drop Contract**: Smart contract that holds and distributes assets
3. **Drop Data**: Information about what's being dropped and to whom
4. **Claim Links**: URLs containing private keys for easy claiming

## Prerequisites

Before we start building, make sure you have:

### Development Environment
```bash
# Install Node.js (v16 or later)
# Install NEAR CLI
npm install -g near-cli

# Install Rust (for smart contract development)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown

# Install cargo-near for NEAR contract development
cargo install cargo-near
```

### NEAR Account Setup
```bash
# Create testnet account (for testing)
near create-account your-test-account.testnet --masterAccount testnet

# Login to your account
near login
```

## Building Your Drop Contract

Let's create a comprehensive drop contract that handles NEAR tokens, NFTs, and FTs.

### Step 1: Project Setup

```bash
# Create new NEAR project
cargo near new drop-contract

# Navigate to project
cd drop-contract
```

### Step 2: Contract Structure

Let's examine the core contract structure:

```rust
// src/lib.rs
use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, Vector};
use near_sdk::json_types::{U128, Base64VecU8};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, Balance, Gas, PanicOnDefault, 
    Promise, PromiseOrValue, PublicKey, BorshStorageKey
};

// Storage keys for our collections
#[derive(BorshSerialize, BorshStorageKey)]
enum StorageKey {
    Drops,
    DropsByOwner,
    KeysForDrop,
}

// Different types of drops we support
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum DropType {
    Near { amount: U128 },
    Nft { contract_id: AccountId, token_id: String },
    Ft { contract_id: AccountId, amount: U128 },
    FunctionCall { 
        receiver_id: AccountId,
        method_name: String,
        args: String,
        attached_deposit: U128,
        gas: Gas,
    },
}

// Individual drop data
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct Drop {
    pub id: u64,
    pub owner_id: AccountId,
    pub drop_type: DropType,
    pub keys_registered: u32,
    pub keys_used: u32,
    pub created_at: u64,
    pub expires_at: Option<u64>,
}

// Main contract structure
#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct DropContract {
    pub owner_id: AccountId,
    pub next_drop_id: u64,
    pub drops: LookupMap<u64, Drop>,
    pub drops_by_owner: LookupMap<AccountId, Vector<u64>>,
    pub keys_for_drop: LookupMap<PublicKey, u64>,
}
```

### Step 3: Contract Implementation

Now let's implement the core functionality:

```rust
#[near_bindgen]
impl DropContract {
    /// Initialize the contract
    #[init]
    pub fn new(owner_id: AccountId) -> Self {
        Self {
            owner_id,
            next_drop_id: 0,
            drops: LookupMap::new(StorageKey::Drops),
            drops_by_owner: LookupMap::new(StorageKey::DropsByOwner),
            keys_for_drop: LookupMap::new(StorageKey::KeysForDrop),
        }
    }

    /// Create a NEAR token drop
    #[payable]
    pub fn create_near_drop(
        &mut self,
        public_keys: Vec<PublicKey>,
        amount_per_key: U128,
        expires_at: Option<u64>,
    ) -> u64 {
        // Validation
        assert!(!public_keys.is_empty(), "Must provide at least one public key");
        assert!(amount_per_key.0 > 0, "Amount must be greater than 0");
        
        let total_amount = amount_per_key.0 * public_keys.len() as u128;
        let attached_deposit = env::attached_deposit();
        
        // Storage cost calculation (approximately 1000 bytes per drop)
        let storage_cost = 1000 * env::storage_byte_cost() * public_keys.len() as u128;
        let required_deposit = total_amount + storage_cost;
        
        assert!(
            attached_deposit >= required_deposit,
            "Insufficient deposit. Required: {}, Attached: {}",
            required_deposit, attached_deposit
        );

        // Create the drop
        let drop_id = self.next_drop_id;
        self.next_drop_id += 1;

        let drop = Drop {
            id: drop_id,
            owner_id: env::predecessor_account_id(),
            drop_type: DropType::Near { amount: amount_per_key },
            keys_registered: public_keys.len() as u32,
            keys_used: 0,
            created_at: env::block_timestamp(),
            expires_at,
        };

        // Store drop data
        self.drops.insert(&drop_id, &drop);
        
        // Register keys for this drop
        for key in public_keys {
            self.keys_for_drop.insert(&key, &drop_id);
        }

        // Update owner's drop list
        let mut owner_drops = self.drops_by_owner
            .get(&drop.owner_id)
            .unwrap_or_else(|| Vector::new(StorageKey::DropsByOwner));
        owner_drops.push(&drop_id);
        self.drops_by_owner.insert(&drop.owner_id, &owner_drops);

        // Return excess deposit
        let excess = attached_deposit - required_deposit;
        if excess > 0 {
            Promise::new(env::predecessor_account_id()).transfer(excess);
        }

        drop_id
    }

    /// Claim a drop using a private key
    pub fn claim_drop(&mut self, account_id: AccountId) -> Promise {
        // Get the public key from the transaction signer
        let public_key = env::signer_account_pk();
        
        // Find the drop associated with this key
        let drop_id = self.keys_for_drop.get(&public_key)
            .expect("No drop found for this key");

        let mut drop = self.drops.get(&drop_id)
            .expect("Drop not found");

        // Validate drop can be claimed
        assert!(drop.keys_used < drop.keys_registered, "All keys for this drop have been used");
        
        if let Some(expires_at) = drop.expires_at {
            assert!(env::block_timestamp() <= expires_at, "Drop has expired");
        }

        // Remove the used key
        self.keys_for_drop.remove(&public_key);
        
        // Update drop usage count
        drop.keys_used += 1;
        self.drops.insert(&drop_id, &drop);

        // Execute the drop based on its type
        match &drop.drop_type {
            DropType::Near { amount } => {
                Promise::new(account_id).transfer(amount.0)
            },
            DropType::Nft { contract_id, token_id } => {
                // Call nft_transfer on the NFT contract
                Promise::new(contract_id.clone()).function_call(
                    "nft_transfer".to_string(),
                    format!(r#"{{"receiver_id": "{}", "token_id": "{}"}}"#, account_id, token_id)
                        .into_bytes(),
                    1, // 1 yoctoNEAR attached deposit
                    Gas(30_000_000_000_000), // 30 TGas
                )
            },
            DropType::Ft { contract_id, amount } => {
                // Call ft_transfer on the FT contract
                Promise::new(contract_id.clone()).function_call(
                    "ft_transfer".to_string(),
                    format!(r#"{{"receiver_id": "{}", "amount": "{}"}}"#, account_id, amount.0)
                        .into_bytes(),
                    1, // 1 yoctoNEAR attached deposit
                    Gas(30_000_000_000_000), // 30 TGas
                )
            },
            DropType::FunctionCall { 
                receiver_id, 
                method_name, 
                args, 
                attached_deposit, 
                gas 
            } => {
                // Execute custom function call
                let processed_args = args.replace("{ACCOUNT_ID}", &account_id.to_string());
                Promise::new(receiver_id.clone()).function_call(
                    method_name.clone(),
                    processed_args.into_bytes(),
                    attached_deposit.0,
                    *gas,
                )
            }
        }
    }

    /// Create an NFT drop
    #[payable]
    pub fn create_nft_drop(
        &mut self,
        public_keys: Vec<PublicKey>,
        nft_contract: AccountId,
        token_ids: Vec<String>,
        expires_at: Option<u64>,
    ) -> u64 {
        assert_eq!(
            public_keys.len(), 
            token_ids.len(), 
            "Number of keys must match number of token IDs"
        );
        
        let drop_id = self.next_drop_id;
        self.next_drop_id += 1;

        // For simplicity, we'll create one drop per NFT
        // In production, you might want to batch these
        for (i, token_id) in token_ids.iter().enumerate() {
            let individual_drop = Drop {
                id: drop_id + i as u64,
                owner_id: env::predecessor_account_id(),
                drop_type: DropType::Nft { 
                    contract_id: nft_contract.clone(), 
                    token_id: token_id.clone() 
                },
                keys_registered: 1,
                keys_used: 0,
                created_at: env::block_timestamp(),
                expires_at,
            };

            self.drops.insert(&(drop_id + i as u64), &individual_drop);
            self.keys_for_drop.insert(&public_keys[i], &(drop_id + i as u64));
        }

        drop_id
    }

    /// Create a fungible token drop
    #[payable]
    pub fn create_ft_drop(
        &mut self,
        public_keys: Vec<PublicKey>,
        ft_contract: AccountId,
        amount_per_key: U128,
        expires_at: Option<u64>,
    ) -> u64 {
        let drop_id = self.next_drop_id;
        self.next_drop_id += 1;

        let drop = Drop {
            id: drop_id,
            owner_id: env::predecessor_account_id(),
            drop_type: DropType::Ft { 
                contract_id: ft_contract, 
                amount: amount_per_key 
            },
            keys_registered: public_keys.len() as u32,
            keys_used: 0,
            created_at: env::block_timestamp(),
            expires_at,
        };

        self.drops.insert(&drop_id, &drop);
        
        for key in public_keys {
            self.keys_for_drop.insert(&key, &drop_id);
        }

        drop_id
    }

    /// Create a function call drop
    #[payable]
    pub fn create_function_call_drop(
        &mut self,
        public_keys: Vec<PublicKey>,
        receiver_id: AccountId,
        method_name: String,
        args: String,
        attached_deposit: U128,
        gas: Gas,
        expires_at: Option<u64>,
    ) -> u64 {
        let drop_id = self.next_drop_id;
        self.next_drop_id += 1;

        let drop = Drop {
            id: drop_id,
            owner_id: env::predecessor_account_id(),
            drop_type: DropType::FunctionCall { 
                receiver_id, 
                method_name, 
                args, 
                attached_deposit, 
                gas 
            },
            keys_registered: public_keys.len() as u32,
            keys_used: 0,
            created_at: env::block_timestamp(),
            expires_at,
        };

        self.drops.insert(&drop_id, &drop);
        
        for key in public_keys {
            self.keys_for_drop.insert(&key, &drop_id);
        }

        drop_id
    }

    /// View methods for querying contract state
    pub fn get_drop(&self, drop_id: u64) -> Option<Drop> {
        self.drops.get(&drop_id)
    }

    pub fn get_drops_by_owner(&self, owner_id: AccountId) -> Vec<Drop> {
        if let Some(drop_ids) = self.drops_by_owner.get(&owner_id) {
            drop_ids.iter()
                .filter_map(|id| self.drops.get(&id))
                .collect()
        } else {
            vec![]
        }
    }

    pub fn get_drop_by_key(&self, public_key: PublicKey) -> Option<Drop> {
        if let Some(drop_id) = self.keys_for_drop.get(&public_key) {
            self.drops.get(&drop_id)
        } else {
            None
        }
    }

    /// Delete expired or completed drops (admin function)
    pub fn cleanup_drops(&mut self, drop_ids: Vec<u64>) {
        assert_eq!(
            env::predecessor_account_id(), 
            self.owner_id, 
            "Only contract owner can cleanup drops"
        );

        for drop_id in drop_ids {
            if let Some(drop) = self.drops.get(&drop_id) {
                // Only cleanup if expired or all keys used
                let is_expired = drop.expires_at
                    .map(|exp| env::block_timestamp() > exp)
                    .unwrap_or(false);
                
                let is_completed = drop.keys_used >= drop.keys_registered;

                if is_expired || is_completed {
                    self.drops.remove(&drop_id);
                    // Note: In production, you'd also want to cleanup the keys_for_drop entries
                }
            }
        }
    }
}

// Implement Default for easy testing
impl Default for DropContract {
    fn default() -> Self {
        Self::new("default.testnet".parse().unwrap())
    }
}
```

### Step 4: Building and Deploying

Now let's build and deploy our contract:

```bash
# Build the contract
cargo near build

# Deploy to testnet (replace with your account)
near deploy your-drop-contract.testnet --wasmFile target/wasm32-unknown-unknown/release/drop_contract.wasm

# Initialize the contract
near call your-drop-contract.testnet new '{"owner_id": "your-account.testnet"}' --accountId your-account.testnet
```

## Creating and Using Drops

Now that our contract is deployed, let's create some drops!

### Step 5: Key Generation

First, we need to generate key pairs for our drops:

```bash
# Generate keys using NEAR CLI
near generate-key

# Or use a script to generate multiple keys
```

Here's a JavaScript helper for key generation:

```javascript
// generate-keys.js
const { KeyPair } = require('near-api-js');

function generateDropKeys(count) {
    const keys = [];
    for (let i = 0; i < count; i++) {
        const keyPair = KeyPair.fromRandom('ed25519');
        keys.push({
            publicKey: keyPair.publicKey.toString(),
            privateKey: keyPair.secretKey,
        });
    }
    return keys;
}

// Generate 5 key pairs
const dropKeys = generateDropKeys(5);
console.log('Generated keys:', JSON.stringify(dropKeys, null, 2));
```

### Step 6: Creating Your First NEAR Drop

```bash
# Create a drop with 1 NEAR per key
near call your-drop-contract.testnet create_near_drop '{
    "public_keys": ["ed25519:YourPublicKeyHere"],
    "amount_per_key": "1000000000000000000000000",
    "expires_at": null
}' --accountId your-account.testnet --deposit 2
```

### Step 7: Building the Frontend

Let's create a simple web interface for our drops:

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>NEAR Drops</title>
    <script src="https://cdn.jsdelivr.net/npm/near-api-js@2.1.4/dist/near-api-js.min.js"></script>
</head>
<body>
    <div id="app">
        <h1>NEAR Drops</h1>
        
        <div id="create-drop">
            <h2>Create Drop</h2>
            <input type="number" id="amount" placeholder="Amount in NEAR" step="0.01">
            <input type="number" id="key-count" placeholder="Number of keys" min="1" max="10">
            <button onclick="createDrop()">Create Drop</button>
        </div>

        <div id="claim-drop" style="display: none;">
            <h2>Claim Drop</h2>
            <input type="text" id="private-key" placeholder="Private key from drop link">
            <input type="text" id="account-id" placeholder="Your account ID">
            <button onclick="claimDrop()">Claim Drop</button>
        </div>

        <div id="results"></div>
    </div>

    <script>
        const CONTRACT_ID = 'your-drop-contract.testnet';
        const NETWORK = 'testnet';

        // Initialize NEAR connection
        async function initNear() {
            const near = await nearApi.connect({
                networkId: NETWORK,
                keyStore: new nearApi.keyStores.BrowserLocalStorageKeyStore(),
                nodeUrl: `https://rpc.${NETWORK}.near.org`,
                walletUrl: `https://wallet.${NETWORK}.near.org`,
            });

            const wallet = new nearApi.WalletConnection(near);
            const contract = new nearApi.Contract(wallet.account(), CONTRACT_ID, {
                viewMethods: ['get_drop', 'get_drops_by_owner'],
                changeMethods: ['create_near_drop', 'claim_drop'],
            });

            return { near, wallet, contract };
        }

        // Generate key pairs
        function generateKeys(count) {
            const keys = [];
            for (let i = 0; i < count; i++) {
                const keyPair = nearApi.KeyPair.fromRandom('ed25519');
                keys.push({
                    publicKey: keyPair.publicKey.toString(),
                    privateKey: keyPair.secretKey,
                });
            }
            return keys;
        }

        // Create a drop
        async function createDrop() {
            try {
                const { wallet, contract } = await initNear();
                
                if (!wallet.isSignedIn()) {
                    wallet.requestSignIn(CONTRACT_ID);
                    return;
                }

                const amount = document.getElementById('amount').value;
                const keyCount = document.getElementById('key-count').value;

                if (!amount || !keyCount) {
                    alert('Please fill in all fields');
                    return;
                }

                // Generate keys
                const keys = generateKeys(parseInt(keyCount));
                const publicKeys = keys.map(k => k.publicKey);

                // Convert NEAR to yoctoNEAR
                const amountYocto = nearApi.utils.format.parseNearAmount(amount);
                const totalDeposit = nearApi.utils.format.parseNearAmount((parseFloat(amount) * parseInt(keyCount) + 1).toString());

                // Create the drop
                const result = await contract.create_near_drop({
                    args: {
                        public_keys: publicKeys,
                        amount_per_key: amountYocto,
                        expires_at: null,
                    },
                    attachedDeposit: totalDeposit,
                    gas: '300000000000000',
                });

                // Generate claim links
                const baseUrl = window.location.origin + '/claim.html';
                const links = keys.map(key => 
                    `${baseUrl}?key=${encodeURIComponent(key.privateKey)}`
                );

                // Display results
                document.getElementById('results').innerHTML = `
                    <h3>Drop Created! ID: ${result}</h3>
                    <h4>Claim Links:</h4>
                    <ul>
                        ${links.map(link => `<li><a href="${link}" target="_blank">${link}</a></li>`).join('')}
                    </ul>
                    <p>Share these links with people you want to give tokens to!</p>
                `;

            } catch (error) {
                console.error('Error creating drop:', error);
                alert('Error creating drop: ' + error.message);
            }
        }

        // Claim a drop
        async function claimDrop() {
            try {
                const { wallet, contract } = await initNear();
                
                const privateKey = document.getElementById('private-key').value;
                const accountId = document.getElementById('account-id').value;

                if (!privateKey || !accountId) {
                    alert('Please fill in all fields');
                    return;
                }

                // Create a temporary key store with the private key
                const keyStore = new nearApi.keyStores.InMemoryKeyStore();
                const keyPair = nearApi.KeyPair.fromString(privateKey);
                await keyStore.setKey(NETWORK, accountId, keyPair);

                // Create connection with this key
                const near = await nearApi.connect({
                    networkId: NETWORK,
                    keyStore,
                    nodeUrl: `https://rpc.${NETWORK}.near.org`,
                });

                const account = await near.account(accountId);
                const contractWithKey = new nearApi.Contract(account, CONTRACT_ID, {
                    changeMethods: ['claim_drop'],
                });

                // Claim the drop
                const result = await contractWithKey.claim_drop({
                    args: { account_id: accountId },
                    gas: '300000000000000',
                });

                document.getElementById('results').innerHTML = `
                    <h3>Drop Claimed Successfully!</h3>
                    <p>Transaction: ${result.transaction.hash}</p>
                `;

            } catch (error) {
                console.error('Error claiming drop:', error);
                alert('Error claiming drop: ' + error.message);
            }
        }

        // Show claim interface if coming from a claim link
        window.onload = function() {
            const urlParams = new URLSearchParams(window.location.search);
            const privateKey = urlParams.get('key');
            
            if (privateKey) {
                document.getElementById('create-drop').style.display = 'none';
                document.getElementById('claim-drop').style.display = 'block';
                document.getElementById('private-key').value = privateKey;
            }
        };
    </script>
</body>
</html>
```

### Step 8: Testing Your Drop Contract

Create a comprehensive test suite:

```rust
// src/lib.rs - Add to the end of your file

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, Balance};

    fn get_context(predecessor_account_id: AccountId) -> VMContextBuilder {
        let mut builder = VMContextBuilder::new();
        builder
            .current_account_id(accounts(0))
            .signer_account_id(predecessor_account_id.clone())
            .predecessor_account_id(predecessor_account_id);
        builder
    }

    #[test]
    fn test_contract_initialization() {
        let context = get_context(accounts(1));
        testing_env!(context.build());

        let contract = DropContract::new(accounts(1));
        assert_eq!(contract.owner_id, accounts(1));
        assert_eq!(contract.next_drop_id, 0);
    }

    #[test]
    fn test_create_near_drop() {
        let context = get_context(accounts(1));
        testing_env!(context.attached_deposit(1_000_000_000_000_000_000_000_000).build());

        let mut contract = DropContract::new(accounts(1));
        
        // Generate a test key pair
        let key_pair = near_sdk::env::random_seed();
        let public_key = PublicKey::try_from(&key_pair[..32]).unwrap();
        
        let drop_id = contract.create_near_drop(
            vec![public_key.clone()],
            U128(500_000_000_000_000_000_000_000), // 0.5 NEAR
            None,
        );

        assert_eq!(drop_id, 0);
        
        let drop = contract.get_drop(drop_id).unwrap();
        assert_eq!(drop.owner_id, accounts(1));
        assert_eq!(drop.keys_registered, 1);
        assert_eq!(drop.keys_used, 0);

        // Test that key is registered
        let found_drop = contract.get_drop_by_key(public_key);
        assert!(found_drop.is_some());
    }

    #[test]
    #[should_panic(expected = "Insufficient deposit")]
    fn test_insufficient_deposit() {
        let context = get_context(accounts(1));
        testing_env!(context.attached_deposit(100).build()); // Too small deposit

        let mut contract = DropContract::new(accounts(1));
        let key_pair = near_sdk::env::random_seed();
        let public_key = PublicKey::try_from(&key_pair[..32]).unwrap();
        
        contract.create_near_drop(
            vec![public_key],
            U128(1_000_000_000_000_000_000_000_000), // 1 NEAR
            None,
        );
    }

    #[test]
    fn test_drop_cleanup() {
        let context = get_context(accounts(1));
        testing_env!(context.attached_deposit(1_000_000_000_000_000_000_000_000).build());

        let mut contract = DropContract::new(accounts(1));
        
        // Create a drop that's immediately expired
        let key_pair = near_sdk::env::random_seed();
        let public_key = PublicKey::try_from(&key_pair[..32]).unwrap();
        
        let drop_id = contract.create_near_drop(
            vec![public_key],
            U128(500_000_000_000_000_000_000_000),
            Some(1), // Expired timestamp
        );

        // Cleanup should work
        contract.cleanup_drops(vec![drop_id]);
        
        // Drop should be removed
        assert!(contract.get_drop(drop_id).is_none());
    }
}
```

## Advanced Features and Security

### Gas Optimization

```rust
// Add these optimizations to your contract

impl DropContract {
    /// Batch create multiple drops efficiently
    #[payable]
    pub fn batch_create_near_drops(
        &mut self,
        drops_data: Vec<(Vec<PublicKey>, U128, Option<u64>)>,
    ) -> Vec<u64> {
        let mut drop_ids = Vec::new();
        
        for (public_keys, amount_per_key, expires_at) in drops_data {
            let drop_id = self.create_near_drop(public_keys, amount_per_key, expires_at);
            drop_ids.push(drop_id);
        }
        
        drop_ids
    }

    /// Efficient key existence check
    pub fn key_exists(&self, public_key: PublicKey) -> bool {
        self.keys_for_drop.contains_key(&public_key)
    }
}
```

### Security Considerations

```rust
// Add these security features

impl DropContract {
    /// Owner-only emergency stop
    pub fn emergency_stop(&mut self) {
        assert_eq!(env::predecessor_account_id(), self.owner_id, "Unauthorized");
        // Implementation for emergency stop
    }

    /// Rate limiting for drop creation
    pub fn create_near_drop_with_limits(
        &mut self,
        public_keys: Vec<PublicKey>,
        amount_per_key: U128,
        expires_at: Option<u64>,
    ) -> u64 {
        let caller = env::predecessor_account_id();
        
        // Limit drops per account per day
        let caller_drops = self.get_drops_by_owner(caller.clone());
        let recent_drops = caller_drops.iter()