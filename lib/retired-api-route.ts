import { NextResponse } from "next/server";

export function retiredApiRoute() {
  return NextResponse.json(
    { error: "Endpoint API server sudah dinonaktifkan. Akses data menggunakan Firebase client SDK dan Firestore Security Rules." },
    { status: 410 }
  );
}
