import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";

export async function GET(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const mockProfile = {
            id: "promoter_abc",
            displayName: "DJ Neon",
            handle: "djneon",
            bio: "Based in NYC. Spreading good vibes and deep house.",
            isPublic: true,
            avatarUrl: "",
            socialLinks: {
                instagram: "https://instagram.com/djneon",
                twitter: "",
                website: "https://djneon.com"
            }
        };

        return NextResponse.json({ profile: mockProfile });
    } catch (error: any) {
        console.error("[Promoter Profile API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

export async function PUT(req: NextRequest) {
    try {
        const decodedToken = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        const body = await req.json();
        
        // In a real app we'd save to Firestore here
        return NextResponse.json({ success: true, profile: body });
    } catch (error: any) {
        console.error("[Promoter Profile API] PUT Error:", error);
        return NextResponse.json(
             { error: error.message || "Internal server error" },
             { status: 500 }
        );
    }
}
