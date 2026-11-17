The **User Directory** module lists users by status and by role. Here an admin invites new people, edits their details,
changes their role or suspends accounts; everyone can edit their own page.

## Opening the module

1. Click the **User Directory** tile in the module block.
2. Choose a group in the sidebar: active, suspended or invited users, all users, or a role.

![User Directory: table of users with name, email and role, and the sidebar with groups by status and by role](./images/users-1.png)

## Inviting users

1. Click the **+** button in the top corner and choose **Invite Users**.
2. Enter the email, choose a role and send the invitation.
3. Backoffice does not send emails: the invitation link is written to the server log. Take the link from there and pass
   it to the invited person.
4. The invited person opens the link, sets a password and signs in.

## Editing a user

1. Click a row to open the user's page.
2. Edit the name, email, role, language or theme and click the save button.
3. Change the **Status** to suspended to block sign-in while keeping the person's data.
4. On your own page you can set a new password, turn on two-factor authentication and add a
   [passkey](/docs/guides/passkey).

![User page of Lan Nguyen: name card with the email and the Editor role, and the form with First Name, Last Name, Email and Password](./images/users-2.png)

## Related

- A user's permissions come from their role and access policies: see [Roles and Policies](/docs/guides/roles-policies).
- API: [list users](/docs/api/users#list-users), [invite users](/docs/api/users#invite-user-s).
- Configuration:
  [invite and password reset links](/docs/configuration/auth#invite-password-reset-and-registration-links).
