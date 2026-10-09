# Firebase Setup Nakagami UCO

Firebase project ID: `nakagami-uco`.

## Authentication

1. Enable Firebase Authentication with Email/Password.
2. Create exactly the two existing app users in Firebase Authentication: one Admin user and one Ranger user.
3. Do not store passwords in Firestore.
4. Do not add custom role fields in browser state, local storage, or Auth custom claims for this app.

The login flow uses the Firebase client SDK. After sign-in, the browser reads only the signed-in user's profile at `users/{uid}`.

## Role Documents

Create one Firestore document per Firebase Authentication UID:

```text
users/{firebaseAuthUid}
```

Required fields:

```json
{
  "email": "user@example.com",
  "displayName": "Nama User",
  "role": "admin",
  "createdAt": "server timestamp"
}
```

Allowed roles are exactly `admin` and `ranger`. The document ID must be the Firebase Authentication UID, not the email address.

Users cannot create or modify their own role. Firestore rules allow users to read their own `users/{uid}` document, allow admins to read user profiles, and deny all client writes to `users`.

## Manual Setup For Existing Users

For the existing Admin user:

1. Open Firebase Console > Authentication > Users.
2. Copy the Admin user's UID.
3. Open Firestore Database.
4. Create or update document `users/{ADMIN_UID}`.
5. Set `email` to the Admin email.
6. Set `displayName` to the Admin display name.
7. Set `role` to `admin`.
8. Set `createdAt` to a Firestore server timestamp.

For the existing Ranger user:

1. Open Firebase Console > Authentication > Users.
2. Copy the Ranger user's UID.
3. Open Firestore Database.
4. Create or update document `users/{RANGER_UID}`.
5. Set `email` to the Ranger email.
6. Set `displayName` to the Ranger display name.
7. Set `role` to `ranger`.
8. Set `createdAt` to a Firestore server timestamp.

Do not let users create these documents from the app. Do not grant admin automatically.

## Environment Variables

Copy `.env.example` to `.env.local` and fill only the Firebase Web App values:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=nakagami-uco
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=
```

No service account JSON, Base64 credentials, client email, or private key is required for login, role lookup, or ordinary app use.

## Security Rules

Deploy `firestore.rules` from this repository.

Role access:

- Admin: Dashboard, Mitra, Collection, Inventory, Field Expense, Transaksi, Monthly Report.
- Ranger: Dashboard, Mitra, Collection, Inventory, Field Expense.
- Ranger cannot read `transactions`, so direct requests for Transaksi or Monthly Report data fail at Firestore Security Rules.
- No user can write `users/{uid}` from the browser.

The UI hides unauthorized menu items, but Firestore Security Rules are the enforcement boundary.

## Exact Firestore Rules

Use the exact contents of `firestore.rules` in this repository. The rules derive role from `users/{request.auth.uid}`, deny all browser writes to `users`, allow operational access to Admin and Ranger, and restrict transaction reads to Admin.

## Indexes

Deploy `firestore.indexes.json`. Firestore may ask for additional range indexes depending on query changes; create only indexes needed by real queries.

## Calculation Rules

- Dashboard excludes documents with `deletedAt`.
- Quantity In comes from valid `inventory_movements` with `type = in`.
- Quantity Out comes from valid `inventory_movements` with `type = out`.
- Collection creates an inventory `in` movement.
- Collection edits that change quantity create correction movements.
- Collection cancellation soft-deletes the collection and creates an `out` reversal movement.
- Field Expense creates exactly one linked paid outcome transaction.
- Deleted Field Expense soft-deletes the expense and linked transaction.
- Monthly Net Profit is `Total Income - Total Outcome`; Field Expense is shown as a subset of outcome and is not subtracted twice.

## Vercel

1. Push the repository.
2. Import it into Vercel.
3. Add the `NEXT_PUBLIC_FIREBASE_*` environment variables.
4. Deploy.
5. Deploy Firestore rules and indexes from Firebase tooling.

The app build does not require real Firebase credentials. Login requires valid Firebase Web App config and the matching `users/{uid}` role document.
