import { Client } from "pg";

const DAYS7_MS = 7 * 24 * 60 * 60 * 1000;

async function activateAllTrials() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const now = new Date();
  const trialExpiry = new Date(now.getTime() + DAYS7_MS);
  const expiryISO = trialExpiry.toISOString();

  // 1. Sellers without active trial (no trial or expired)
  // Note: users.id is text, user_roles.user_id is uuid — cast to match
  const sellersRes = await client.query(`
    SELECT u.id, u.trial_expires_at
    FROM users u
    INNER JOIN user_roles ur ON u.id = ur.user_id::text
    WHERE ur.role = 'seller'
      AND (u.trial_expires_at IS NULL OR u.trial_expires_at < NOW())
  `);

  console.log(`Found ${sellersRes.rowCount} sellers without active trial`);

  let sellerUpdated = 0;
  for (const row of sellersRes.rows) {
    await client.query(
      `UPDATE users SET trial_expires_at = $1 WHERE id = $2`,
      [expiryISO, row.id]
    );
    sellerUpdated++;
  }

  // 2. Drivers without active trial (no trial or expired)
  const driversRes = await client.query(`
    SELECT user_id::text AS user_id, trial_expires_at
    FROM driver_profiles
    WHERE trial_expires_at IS NULL OR trial_expires_at < NOW()
  `);

  console.log(`Found ${driversRes.rowCount} drivers without active trial`);

  let driverUpdated = 0;
  for (const row of driversRes.rows) {
    await client.query(
      `UPDATE driver_profiles SET trial_expires_at = $1 WHERE user_id = $2::uuid`,
      [expiryISO, row.user_id]
    );
    driverUpdated++;
  }

  await client.end();

  console.log(`\n✅ DONE!`);
  console.log(`Sellers activated: ${sellerUpdated}`);
  console.log(`Drivers activated: ${driverUpdated}`);
  console.log(`Total accounts with 7-day trial: ${sellerUpdated + driverUpdated}`);
  console.log(`Trial expires: ${expiryISO}`);
}

activateAllTrials().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
