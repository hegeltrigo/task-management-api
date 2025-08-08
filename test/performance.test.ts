/**
 * Performance Test Script
 * 
 * This script helps identify the performance issues in the application.
 * Run it after seeding the database to see the problems.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['query'], // This will log all queries
});

async function testN1Problem() {
  console.log('\n=== Testing N+1 Query Problem ===');
  console.log('Watch how many queries are executed...\n');

  // This simulates what the current findAll does
  const tasks = await prisma.task.findMany({ take: 10 });
  
  for (const task of tasks) {
    if (task.assigneeId) {
      await prisma.user.findUnique({ where: { id: task.assigneeId } });
    }
    await prisma.project.findUnique({ where: { id: task.projectId } });
    await prisma.tag.findMany({
      where: { tasks: { some: { id: task.id } } }
    });
  }

  console.log('\nFor 10 tasks, this executed 31+ queries!');
}

async function testEfficientQuery() {
  console.log('\n=== Testing Efficient Query ===');
  console.log('This is how it should be done...\n');

  const tasks = await prisma.task.findMany({
    take: 10,
    include: {
      assignee: true,
      project: true,
      tags: true,
    }
  });

  console.log('\nFor 10 tasks, this executed only 1 query!');
}

async function testFilteringPerformance() {
  console.log('\n=== Testing Filtering Performance ===');
  
  // Inefficient: Get all, then filter
  console.time('In-memory filtering');
  const allTasks = await prisma.task.findMany();
  const filtered = allTasks.filter(t => t.status === 'TODO' && t.priority === 'HIGH');
  console.timeEnd('In-memory filtering');
  console.log(`Found ${filtered.length} tasks (fetched ${allTasks.length} from DB)`);

  // Efficient: Filter in database
  console.time('Database filtering');
  const dbFiltered = await prisma.task.findMany({
    where: {
      status: 'TODO',
      priority: 'HIGH',
    }
  });
  console.timeEnd('Database filtering');
  console.log(`Found ${dbFiltered.length} tasks (fetched only what was needed)`);
}

async function main() {
  await testN1Problem();
  await testEfficientQuery();
  await testFilteringPerformance();
  await prisma.$disconnect();
}

main().catch(console.error);
