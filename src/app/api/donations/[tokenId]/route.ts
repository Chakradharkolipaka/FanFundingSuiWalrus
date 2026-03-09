import { NextResponse } from "next/server";

const APTOS_NODE_URL =
  process.env.NEXT_PUBLIC_APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com/v1";
const MODULE_ADDRESS = process.env.NEXT_PUBLIC_MODULE_ADDRESS || "";

export const dynamic = "force-dynamic";

/**
 * GET /api/donations/[tokenId]
 * Fetches donation events for a specific NFT from the Aptos module events.
 */
export async function GET(
  request: Request,
  { params }: { params: { tokenId: string } }
) {
  try {
    const tokenId = parseInt(params.tokenId);
    if (isNaN(tokenId)) {
      return NextResponse.json({ error: "Invalid token ID" }, { status: 400 });
    }

    if (!MODULE_ADDRESS) {
      return NextResponse.json({ error: "Module address not configured" }, { status: 500 });
    }

    // Fetch donation events from the Aptos module's DonationEvents handle
    const eventsUrl = `${APTOS_NODE_URL}/accounts/${MODULE_ADDRESS}/events/${MODULE_ADDRESS}::nft_donation::DonationEvents/events?limit=100`;

    const eventsRes = await fetch(eventsUrl);

    if (!eventsRes.ok) {
      // If events resource doesn't exist yet, return empty
      if (eventsRes.status === 404) {
        return NextResponse.json([]);
      }
      const txt = await eventsRes.text();
      console.error("Failed to fetch events:", eventsRes.status, txt);
      return NextResponse.json({ error: "Failed to fetch events" }, { status: 502 });
    }

    const events = await eventsRes.json();

    // Filter events for the requested tokenId
    const donations: Array<{
      donor: string;
      amount: string;
      timestamp: string;
      sequenceNumber: string;
    }> = [];

    for (const event of events) {
      const data = event.data;
      if (data && parseInt(data.token_id) === tokenId) {
        donations.push({
          donor: data.donor,
          amount: data.amount,
          timestamp: data.timestamp,
          sequenceNumber: event.sequence_number,
        });
      }
    }

    return NextResponse.json(donations);
  } catch (error) {
    console.error("Error fetching donations:", error);
    return NextResponse.json(
      { error: "Failed to fetch donations" },
      { status: 500 }
    );
  }
}
