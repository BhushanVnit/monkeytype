const { CronJob } = require("cron");
const { mongoDB } = require("../init/mongodb");
const BotDAO = require("../dao/bot");
const LeaderboardsDAO = require("../dao/leaderboards");

const CRON_SCHEDULE = "30 4/5 * * * *";
const RECENT_AGE_MINUTES = 10;
const RECENT_AGE_MILLISECONDS = RECENT_AGE_MINUTES * 60 * 1000;

async function getTop10(leaderboardTime) {
  return await LeaderboardsDAO.get("time", leaderboardTime, "english", 0, 10);
}

async function updateLeaderboardAndNotifyChanges(leaderboardTime) {
  const top10BeforeUpdate = await getTop10(leaderboardTime);

  const previousRecordsMap = Object.fromEntries(
    top10BeforeUpdate.map((record) => {
      return [record.uid, record];
    })
  );

  await LeaderboardsDAO.update("time", leaderboardTime, "english");

  const top10AfterUpdate = await getTop10(leaderboardTime);

  const newRecords = top10AfterUpdate.filter((record) => {
    const userId = record.uid;

    const userImprovedRank =
      userId in previousRecordsMap &&
      previousRecordsMap[userId].rank > record.rank;

    const newUserInTop10 = !(userId in previousRecordsMap);

    const isRecentRecord =
      record.timestamp > Date.now() - RECENT_AGE_MILLISECONDS;

    return (userImprovedRank || newUserInTop10) && isRecentRecord;
  });

  if (newRecords.length > 0) {
    await BotDAO.announceLbUpdate(
      newRecords,
      `time ${leaderboardTime} english`
    );
  }
}

async function updateLeaderboards() {
  await updateLeaderboardAndNotifyChanges("15");
  await updateLeaderboardAndNotifyChanges("60");
}

module.exports = new CronJob(CRON_SCHEDULE, updateLeaderboards);
