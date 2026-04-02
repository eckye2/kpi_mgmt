/* eslint-disable no-console */
/**
 * Reset a user's password (bcrypt 10 rounds, same as login API / admin reset).
 *
 * From project root (load .env — Node 20+: --env-file):
 *   node --env-file=.env prisma/set-user-password.js
 *   node --env-file=.env prisma/set-user-password.js --email user001@kpcqa.or.kr --password 2026000001
 *
 * Or npm (only if package.json "scripts" includes db:set-password — see below):
 *   npm run db:set-password -- --email user001@kpcqa.or.kr --password 2026000001
 *
 * If npm says "Missing script: db:set-password", add this next to db:seed in package.json:
 *   "db:set-password": "node prisma/set-user-password.js"
 *
 * Omit --password to use default 2026000001 (seed default for user001).
 * Add --no-must-change to skip forcing password change on next login.
 */
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

function parseArgs(argv) {
  const out = {
    email: "user001@kpcqa.or.kr",
    password: "2026000001",
    mustChangePassword: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--email" && argv[i + 1]) {
      out.email = String(argv[++i]).trim();
    } else if (a === "--password" && argv[i + 1]) {
      out.password = String(argv[++i]);
    } else if (a === "--no-must-change") {
      out.mustChangePassword = false;
    } else if (a === "-h" || a === "--help") {
      out.help = true;
    }
  }
  return out;
}

function printHelp() {
  console.log(`
Usage: node prisma/set-user-password.js [options]

Options:
  --email <addr>     User email (default: user001@kpcqa.or.kr)
  --password <pwd>   New password (default: 2026000001)
  --no-must-change   Do not set mustChangePassword=true

Examples:
  node --env-file=.env prisma/set-user-password.js
  node --env-file=.env prisma/set-user-password.js --email user001@kpcqa.or.kr --password 2026000001
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }

  const email = args.email.trim().toLowerCase();
  const password = String(args.password).trim();

  if (!email) {
    console.error("Error: email is required.");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Error: password must be at least 6 characters.");
    process.exit(1);
  }

  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error(`Error: no user found for email: ${args.email}`);
    process.exit(2);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: args.mustChangePassword,
    },
  });

  console.log(
    `Updated password for ${user.email} (id=${user.id}, mustChangePassword=${args.mustChangePassword}).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
