import { world, system, ItemStack, BlockLocation } from "@minecraft/server";
import { ActionFormData, MessageFormData } from "@minecraft/server-ui";

/**
 * Daftar item Friendly Fishing
 */
const RAW_ITEMS = [
  "mnp_ci:animal_yellowfin_tuna",
  "mnp_ci:animal_swordfish",
  "mnp_ci:animal_striped_bass",
  "mnp_ci:animal_shad",
  "mnp_ci:animal_sea_urchin",
  "mnp_ci:animal_sea_bass",
  "mnp_ci:animal_salmon_king",
  "mnp_ci:animal_pearl_oyster",
  "mnp_ci:animal_mahi_mahi",
  "mnp_ci:animal_lionfish",
  "mnp_ci:animal_golden_trout",
  "mnp_ci:animal_giant_goldfish",
  "mnp_ci:animal_giant_clam",
  "mnp_ci:animal_flounder",
  "mnp_ci:animal_crab",
  "mnp_ci:animal_barracuda",
  "mnp_ci:animal_anchovy"
];

const COOKED_ITEMS = [
  "mnp_ci:cooked_animal_yellowfin_tuna",
  "mnp_ci:cooked_animal_swordfish",
  "mnp_ci:cooked_animal_striped_bass",
  "mnp_ci:cooked_animal_shad",
  "mnp_ci:cooked_animal_sea_urchin",
  "mnp_ci:cooked_animal_sea_bass",
  "mnp_ci:cooked_animal_salmon_king",
  "mnp_ci:cooked_animal_pearl_oyster",
  "mnp_ci:cooked_animal_mahi_mahi",
  "mnp_ci:cooked_animal_lionfish",
  "mnp_ci:cooked_animal_golden_trout",
  "mnp_ci:cooked_animal_giant_goldfish",
  "mnp_ci:cooked_animal_giant_clam",
  "mnp_ci:cooked_animal_flounder",
  "mnp_ci:cooked_animal_crab",
  "mnp_ci:cooked_animal_barracuda",
  "mnp_ci:cooked_animal_anchovy"
];

/**
 * Quest harian
 */
let dailyQuests = [];
let lastDayKey = null;

function getDayKey() {
  const t = world.getTime();
  const days = Math.floor(t / 24000);
  return `d${days}`;
}

function rollDailyQuests() {
  const pool = [];
  RAW_ITEMS.forEach(id => pool.push({ item: id, qty: 3, reward: { id: "minecraft:emerald", count: 2 } }));
  COOKED_ITEMS.forEach(id => pool.push({ item: id, qty: 2, reward: { id: "minecraft:gold_ingot", count: 1 } }));

  const picks = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool[idx]);
    pool.splice(idx, 1);
  }
  dailyQuests = picks;
}

system.runInterval(() => {
  const dayKey = getDayKey();
  if (dayKey !== lastDayKey) {
    rollDailyQuests();
    lastDayKey = dayKey;
  }
}, 200);

/**
 * UI utama SellingBin
 */
async function openSellingBinUI(player, blockLoc) {
  const form = new ActionFormData()
    .title("Selling Bin")
    .body("Pilih fungsi:")
    .button("Process Sales")
    .button("View Quests");

  const res = await form.show(player);
  if (res.canceled) return;

  if (res.selection === 0) {
    await processSales(player, blockLoc);
  } else if (res.selection === 1) {
    await showQuests(player);
  }
}

/**
 * Proses penjualan item raw
 */
async function processSales(player, blockLoc) {
  const block = player.dimension.getBlock(blockLoc);
  const inv = block.getComponent("minecraft:inventory");
  if (!inv) return;

  let rewards = [];
  for (let i = 0; i < inv.container.size; i++) {
    const stack = inv.container.getItem(i);
    if (!stack) continue;
    if (!RAW_ITEMS.includes(stack.typeId)) continue;

    const qty = stack.amount;
    inv.container.setItem(i, undefined);

    rewards.push({ id: "minecraft:iron_ingot", count: qty });
  }

  rewards.forEach(r => {
    player.getComponent("minecraft:inventory").container.addItem(new ItemStack(r.id, r.count));
  });

  const summary = rewards.length
    ? rewards.map(r => `+ ${r.count} ${r.id}`).join("\n")
    : "Tidak ada item raw yang dijual.";

  await new MessageFormData()
    .title("Sales Summary")
    .body(summary)
    .button1("OK")
    .button2("Close")
    .show(player);
}

/**
 * Tampilkan quest harian
 */
async function showQuests(player) {
  const form = new ActionFormData().title("Daily Quests");
  dailyQuests.forEach((q, idx) => {
    form.button(`${idx + 1}. ${q.item} x${q.qty}\nReward: ${q.reward.count} ${q.reward.id}`);
  });

  const res = await form.show(player);
  if (res.canceled) return;
  const quest = dailyQuests[res.selection];
  if (!quest) return;

  const inv = player.getComponent("minecraft:inventory").container;
  let have = 0;
  for (let i = 0; i < inv.size; i++) {
    const stack = inv.getItem(i);
    if (stack && stack.typeId === quest.item) {
      have += stack.amount;
    }
  }

  if (have < quest.qty) {
    await new MessageFormData()
      .title("Quest")
      .body(`Belum cukup: butuh ${quest.qty}, kamu punya ${have}.`)
      .button1("OK")
      .button2("Close")
      .show(player);
    return;
  }

  // Kurangi item
  let remain = quest.qty;
  for (let i = 0; i < inv.size && remain > 0; i++) {
    const stack = inv.getItem(i);
    if (!stack || stack.typeId !== quest.item) continue;
    if (stack.amount <= remain) {
      remain -= stack.amount;
      inv.setItem(i, undefined);
    } else {
      stack.amount -= remain;
      inv.setItem(i, stack);
      remain = 0;
    }
  }

  // Berikan reward
  player.getComponent("minecraft:inventory").container.addItem(new ItemStack(quest.reward.id, quest.reward.count));

  await new MessageFormData()
    .title("Quest")
    .body("Quest selesai! Reward diberikan.")
    .button1("OK")
    .button2("Close")
    .show(player);
}

/**
 * Hook interaksi blok
 */
world.afterEvents.playerInteractWithBlock.subscribe(ev => {
  if (ev.block.typeId !== "aha:selling_bin") return;
  const loc = ev.block.location;
  openSellingBinUI(ev.player, new BlockLocation(loc.x, loc.y, loc.z));
});
