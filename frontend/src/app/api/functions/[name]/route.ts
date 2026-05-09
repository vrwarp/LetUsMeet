import { NextRequest, NextResponse } from "next/server";

const PROJECT_SUFFIX = "wu3h4frdia-uc.a.run.app";

export async function POST(req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const functionName = name.toLowerCase();
  const targetUrl = `https://${functionName}-${PROJECT_SUFFIX}`;

  try {
    let idToken = "";

    // 1. Get an ID token from the Google Metadata Server (only works in production App Hosting/Cloud Run)
    if (process.env.NODE_ENV === "production") {
      try {
        const tokenRes = await fetch(
          `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${targetUrl}`,
          { headers: { "Metadata-Flavor": "Google" } }
        );
        if (tokenRes.ok) {
          idToken = await tokenRes.text();
        } else {
          console.error("Failed to fetch ID token from metadata server:", await tokenRes.text());
        }
      } catch (e) {
        console.error("Metadata server unreachable (likely running locally):", e);
      }
    }

    // 2. Forward the request to the private Cloud Function
    const body = await req.json();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (idToken) {
      headers["Authorization"] = `Bearer ${idToken}`;
    }

    const functionRes = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await functionRes.json();
    return NextResponse.json(data, { status: functionRes.status });
  } catch (error: any) {
    console.error(`Error proxying to function ${functionName}:`, error);
    return NextResponse.json({ error: "Failed to proxy request", details: error.message }, { status: 500 });
  }
}
