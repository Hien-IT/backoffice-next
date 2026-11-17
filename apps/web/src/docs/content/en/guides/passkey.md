A passkey lets you sign in without a password, with your device's fingerprint, face or PIN (Touch ID, Windows Hello, a
security key, a password manager). Signing in with a passkey replaces both the password and the two-factor
authentication code.

## Who can use it

Users who sign in with Backoffice's own email and password and whose status is active. SSO and LDAP users cannot use
passkeys.

## Server requirements

Passkeys are only on when the `PUBLIC_URL` variable is a full URL with a domain name, for example
`https://backoffice.example.com` (not an IP address). Users must open the app at exactly that address. See
[general configuration](/docs/configuration/general#general).

## Adding a passkey

1. Open the user menu at the bottom of the sidebar and choose your page.
2. Scroll down to the **Passkeys** card and click **Add passkey**.
3. Enter your current password to confirm.
4. Follow the browser's dialog (fingerprint, face, PIN), then give the passkey a name.

![Passkeys card on the user page: the Add passkey button and an empty passkey table](./images/passkey-2.png)

Each person can have up to 10 passkeys. In the card you can rename or delete a passkey; an admin can delete another
person's passkeys when they lose their device.

## Signing in with a passkey

1. Open the sign-in page.
2. Click **Sign in with a passkey** and confirm on your device.

![Sign-in page with the sign in with a passkey button below the password sign-in button](./images/passkey-1.png)

## Limits

- The two-factor authentication setup page still uses OTP codes only.
- Deleting a passkey in Backoffice does not remove it from the device; remove it on the device as well.

## Related

- API: [sign in with a passkey](/docs/api/backoffice#sign-in-with-a-passkey),
  [passkeys of the current user](/docs/api/backoffice#list-the-passkeys-of-the-current-user).
