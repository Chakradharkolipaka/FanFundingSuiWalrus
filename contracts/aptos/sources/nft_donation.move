module fan_funding::nft_donation {
    use std::string::{Self, String};
    use std::signer;
    use std::vector;
    use aptos_framework::coin;
    use aptos_framework::aptos_coin::AptosCoin;
    use aptos_framework::event;
    use aptos_framework::account;
    use aptos_framework::timestamp;

    // ─── Error codes ────────────────────────────────────────────
    const E_NOT_INITIALIZED: u64 = 1;
    const E_ALREADY_INITIALIZED: u64 = 2;
    const E_TOKEN_NOT_FOUND: u64 = 3;
    const E_ZERO_AMOUNT: u64 = 4;

    // ─── Structs ────────────────────────────────────────────────

    /// Data for each minted NFT
    struct NFTToken has store, drop, copy {
        id: u64,
        creator: address,
        name: String,
        description: String,
        token_uri: String,
        total_funded: u64,
        created_at: u64,
    }

    /// Global collection stored under the module deployer
    struct Collection has key {
        tokens: vector<NFTToken>,
        next_id: u64,
    }

    /// Event emitted on each donation
    struct DonationEvent has drop, store {
        token_id: u64,
        donor: address,
        amount: u64,
        timestamp: u64,
    }

    /// Event handle holder
    struct DonationEvents has key {
        events: event::EventHandle<DonationEvent>,
    }

    /// Event emitted when an NFT is minted
    struct MintEvent has drop, store {
        token_id: u64,
        creator: address,
        name: String,
        token_uri: String,
        timestamp: u64,
    }

    /// Event handle holder for mint events
    struct MintEvents has key {
        events: event::EventHandle<MintEvent>,
    }

    // ─── Entry functions ────────────────────────────────────────

    /// Initialize the collection. Must be called once after deployment.
    public entry fun init_collection(deployer: &signer) {
        let addr = signer::address_of(deployer);
        assert!(!exists<Collection>(addr), E_ALREADY_INITIALIZED);

        move_to(deployer, Collection {
            tokens: vector::empty<NFTToken>(),
            next_id: 1, // token IDs start at 1
        });
        move_to(deployer, DonationEvents {
            events: account::new_event_handle<DonationEvent>(deployer),
        });
        move_to(deployer, MintEvents {
            events: account::new_event_handle<MintEvent>(deployer),
        });
    }

    /// Mint a new NFT. Anyone can call this.
    public entry fun mint_nft(
        account: &signer,
        name: vector<u8>,
        description: vector<u8>,
        token_uri: vector<u8>,
    ) acquires Collection, MintEvents {
        let creator_addr = signer::address_of(account);
        let collection = borrow_global_mut<Collection>(@fan_funding);

        let token_id = collection.next_id;
        let now = timestamp::now_seconds();

        let token = NFTToken {
            id: token_id,
            creator: creator_addr,
            name: string::utf8(name),
            description: string::utf8(description),
            token_uri: string::utf8(token_uri),
            total_funded: 0,
            created_at: now,
        };

        vector::push_back(&mut collection.tokens, token);
        collection.next_id = token_id + 1;

        // Emit mint event
        let mint_events = borrow_global_mut<MintEvents>(@fan_funding);
        event::emit_event(&mut mint_events.events, MintEvent {
            token_id,
            creator: creator_addr,
            name: string::utf8(name),
            token_uri: string::utf8(token_uri),
            timestamp: now,
        });
    }

    /// Donate APT to the creator of an NFT.
    public entry fun donate(
        donor: &signer,
        token_id: u64,
        amount: u64,
    ) acquires Collection, DonationEvents {
        assert!(amount > 0, E_ZERO_AMOUNT);

        let collection = borrow_global_mut<Collection>(@fan_funding);
        let len = vector::length(&collection.tokens);

        // Find token by ID (tokens are stored sequentially, index = id - 1)
        let index = token_id - 1;
        assert!(index < len, E_TOKEN_NOT_FOUND);

        let token = vector::borrow_mut(&mut collection.tokens, index);

        // Transfer APT from donor to the NFT creator
        coin::transfer<AptosCoin>(donor, token.creator, amount);

        // Update total funded
        token.total_funded = token.total_funded + amount;

        // Emit donation event
        let events = borrow_global_mut<DonationEvents>(@fan_funding);
        event::emit_event(&mut events.events, DonationEvent {
            token_id,
            donor: signer::address_of(donor),
            amount,
            timestamp: timestamp::now_seconds(),
        });
    }

    // ─── View functions ─────────────────────────────────────────

    #[view]
    /// Returns the total number of minted NFTs.
    public fun total_supply(): u64 acquires Collection {
        let collection = borrow_global<Collection>(@fan_funding);
        collection.next_id - 1
    }

    #[view]
    /// Returns full details of a token by ID.
    public fun get_token(token_id: u64): (
        address, String, String, String, u64, u64
    ) acquires Collection {
        let collection = borrow_global<Collection>(@fan_funding);
        let index = token_id - 1;
        assert!(index < vector::length(&collection.tokens), E_TOKEN_NOT_FOUND);

        let token = vector::borrow(&collection.tokens, index);
        (
            token.creator,
            token.name,
            token.description,
            token.token_uri,
            token.total_funded,
            token.created_at,
        )
    }

    #[view]
    /// Returns only the token_uri for a given token ID.
    public fun get_token_uri(token_id: u64): String acquires Collection {
        let collection = borrow_global<Collection>(@fan_funding);
        let index = token_id - 1;
        assert!(index < vector::length(&collection.tokens), E_TOKEN_NOT_FOUND);
        let token = vector::borrow(&collection.tokens, index);
        token.token_uri
    }

    #[view]
    /// Returns the total donations for a given token ID.
    public fun get_total_donations(token_id: u64): u64 acquires Collection {
        let collection = borrow_global<Collection>(@fan_funding);
        let index = token_id - 1;
        assert!(index < vector::length(&collection.tokens), E_TOKEN_NOT_FOUND);
        let token = vector::borrow(&collection.tokens, index);
        token.total_funded
    }

    #[view]
    /// Returns the owner/creator of a given token ID.
    public fun owner_of(token_id: u64): address acquires Collection {
        let collection = borrow_global<Collection>(@fan_funding);
        let index = token_id - 1;
        assert!(index < vector::length(&collection.tokens), E_TOKEN_NOT_FOUND);
        let token = vector::borrow(&collection.tokens, index);
        token.creator
    }
}
