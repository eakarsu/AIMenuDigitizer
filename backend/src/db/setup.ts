import migrate from './migrate';
import seed from './seed';
import pool from './connection';

async function setup() {
  try {
    console.log('🔧 Setting up database...\n');

    await migrate();
    console.log('');
    await seed();

    console.log('\n✅ Database setup complete!');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();
