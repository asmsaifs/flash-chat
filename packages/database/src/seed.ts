import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Delete the orphaned demo workspace that has no members (causes GET /workspaces to return [] for all users)
  await prisma.workspace.deleteMany({ where: { slug: 'demo' } })
  console.log('Seed complete — workspaces and users are created on first login via Clerk auth.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
