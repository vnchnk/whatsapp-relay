import "dotenv/config";
import { connect } from "./socket.js";

/**
 * One-off helper: lists every group the account is in, with its JID.
 * Copy the JIDs you need into .env (SOURCE_GROUP / DEST_GROUPS), then Ctrl-C.
 */
connect(async (sock) => {
  const groups = await sock.groupFetchAllParticipating();
  const rows = Object.values(groups)
    .map((g) => ({ name: g.subject, jid: g.id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`\nFound ${rows.length} groups:\n`);
  for (const { name, jid } of rows) console.log(`${jid}   ${name}`);
  console.log("\nCopy JIDs into .env, then Ctrl-C.\n");
});
