// scripts/run-local-cron.ts

import cron from 'node-cron';

const API_URL = 'http://localhost:3000/api/cron/send-reminders';

// This schedule runs the job every minute for easy testing.
// For a daily test, you could use '0 9 * * *' (9 AM).
const schedule = '* * * * *'; 

console.log(`🕒 Local cron job scheduled to run every minute.`);
console.log(`Will trigger API at: ${API_URL}`);

cron.schedule(schedule, async () => {
  try {
    const now = new Date().toLocaleTimeString();
    console.log(`\n-- [${now}] --`);
    console.log(`🚀 Triggering cron job...`);
    
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log(`✅ Cron job finished successfully:`, data.message);

  } catch (error) {
    console.error('❌ Error running cron job:', error);
  }
});