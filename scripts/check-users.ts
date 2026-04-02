import { prisma } from '../lib/prisma'

async function main() {
  console.log('Checking users in database...\n')
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      employeeNo: true,
      email: true,
      name: true,
      dept: true,
      subDept: true,
      role: true,
    },
    take: 10,
  })

  console.log(`Found ${users.length} users:`)
  console.table(users)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
