"use client";

import { Suspense, useEffect, useState } from "react";
import { GroupGuard } from "@/components/GroupGuard";
import {
  isStudentGroup,
  minutesToLabel,
  parseTimeToMinutes,
} from "@/lib/access";
import {
  clearClassSchedule,
  loadState,
  setClassSchedule,
  setUserGroup,
  updateState,
} from "@/lib/storage";
import { PROFILE_OPTIONS, findProfileKey, type ProfileOption } from "@/lib/profiles";
import type { ClassBlock, UserGroup } from "@/lib/types";

const DAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];


function SettingsInner() {
  const [group, setGroup] = useState<UserGroup | null>(null);
  const [profileKey, setProfileKey] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<ClassBlock[]>([]);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState("6:00 PM");
  const [end, setEnd] = useState("9:00 PM");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const state = loadState();
    setGroup(state.userGroup);
    setProfileKey(findProfileKey(state.userGroup, state.studentYear));
    setBlocks(state.classSchedule.blocks);
  }, []);

  function saveGroup(option: ProfileOption) {
    const updated = setUserGroup(option.group, option.year);
    updateState({ usageNoticeSeen: false });
    setGroup(option.group);
    setProfileKey(option.key);
    setBlocks(updated.classSchedule.blocks);
    setMessage("Group updated. You’ll see the usage notice again.");
    window.location.href = "/?notice=1";
  }

  function addBlock() {
    const startMinutes = parseTimeToMinutes(start);
    const endMinutes = parseTimeToMinutes(end);
    if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) {
      setMessage("Use times like 6:00 PM and make sure end is after start.");
      return;
    }
    const next = [
      ...blocks,
      {
        dayOfWeek: day,
        startMinutes,
        endMinutes,
        label: `${DAY_OPTIONS.find((d) => d.value === day)?.label} ${start}–${end}`,
      },
    ];
    setBlocks(next);
    setClassSchedule({ blocks: next });
    setMessage("Class schedule saved on this device (Philippine time).");
  }

  function removeBlock(index: number) {
    const next = blocks.filter((_, i) => i !== index);
    setBlocks(next);
    setClassSchedule({ blocks: next });
    setMessage("Class block removed.");
  }

  function clearSchedule() {
    clearClassSchedule();
    setBlocks([]);
    setMessage("Class schedule cleared. You can add new blocks anytime.");
  }

  const showSchedule = isStudentGroup(group);

  return (
    <section className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-2 text-muted">
          Group and class schedule stay on this device only. No account required.
          Class times use Philippine time (Asia/Manila).
        </p>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl">Your group</h2>
        <div className="grid gap-2">
          {PROFILE_OPTIONS.map((opt) => (
            <label
              key={opt.key}
              className="flex items-center gap-3 rounded-md border border-line bg-white/70 px-3 py-3"
            >
              <input
                type="radio"
                name="group"
                checked={profileKey === opt.key}
                onChange={() => saveGroup(opt)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {showSchedule && (
        <div className="space-y-3">
          <h2 className="font-display text-xl">Class schedule</h2>
          <p className="text-sm text-muted">
            Pre-filled with a typical law-school week (Mon–Fri 6:00–9:00 PM,
            Sat–Sun 8:00 AM–6:00 PM, Philippine time). Edit or clear it to match
            your real classes. Year 1–2: all features pause during these hours.
            Year 3–4: Quick Check leads the home screen during these hours.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <select
              className="rounded-md border border-line bg-white px-3 py-2"
              value={day}
              onChange={(e) => setDay(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
            <input
              className="rounded-md border border-line bg-white px-3 py-2"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label="Start time"
              placeholder="6:00 PM"
            />
            <input
              className="rounded-md border border-line bg-white px-3 py-2"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              aria-label="End time"
              placeholder="9:00 PM"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addBlock}
              className="rounded-md bg-accent px-4 py-2 text-white"
            >
              Add class block
            </button>
            <button
              type="button"
              onClick={clearSchedule}
              className="rounded-md border border-line px-4 py-2"
            >
              Clear schedule
            </button>
          </div>
          <ul className="space-y-2">
            {blocks.length === 0 ? (
              <li className="rounded-md border border-dashed border-line px-3 py-3 text-sm text-muted">
                No class blocks. Features are available any time until you add
                hours.
              </li>
            ) : (
              blocks.map((block, index) => (
                <li
                  key={`${block.dayOfWeek}-${block.startMinutes}-${index}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-line bg-white/70 px-3 py-2 text-sm"
                >
                  <span>
                    {block.label ??
                      `${DAY_OPTIONS.find((d) => d.value === block.dayOfWeek)?.label} ${minutesToLabel(block.startMinutes)}–${minutesToLabel(block.endMinutes)}`}
                  </span>
                  <button
                    type="button"
                    className="text-warn underline"
                    onClick={() => removeBlock(index)}
                  >
                    Remove
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {group && !showSchedule && (
        <p className="rounded-md border border-line bg-white/70 px-3 py-3 text-sm text-muted">
          Bar reviewees have no class schedule. Practice is available anytime.
        </p>
      )}

      {message && <p className="text-sm text-accent">{message}</p>}
    </section>
  );
}

export default function SettingsPage() {
  return (
    <GroupGuard>
      <Suspense fallback={<p className="text-muted">Loading…</p>}>
        <SettingsInner />
      </Suspense>
    </GroupGuard>
  );
}
