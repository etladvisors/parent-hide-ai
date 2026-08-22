# sg-digest — nightly search-log uploader (macOS only, now optional)

> **Not needed on a Chromebook, and cannot run there.** ChromeOS has no
> launchd, and Chrome's extension storage sits in an encrypted user partition
> that no user process — including anything in the Linux dev environment — can
> read. Since extension v3.1.0 the service worker uploads its own logs to the
> same `POST /log` endpoint, in the same wire format, on every platform. Use
> this job only if you also want logs from a Mac, or prefer the extension not
> to transmit (set `LOG_UPLOAD_URL` to null and let this job do it instead).
> Running both at once is safe: they keep separate cursors, and entries are
> tagged by `machine`.

Runs on the **child's Mac**, under the **child's macOS user account**. Once a
night it reads Search Guard's local logs (blocked attempts + observed
searches) directly from Chrome's on-disk extension storage and uploads
anything new to your Worker. The extension itself never transmits data; this
parent-installed script does, from a parent-administered machine.

## Install (on the child's Mac, logged in as her macOS user)

1. Install Node.js if it isn't there (`brew install node` or the pkg from
   nodejs.org).

2. Copy this folder to `~/sg-digest`, then:

   ```sh
   cd ~/sg-digest
   npm install
   ```

3. Create `~/sg-digest/config.json`:

   ```json
   {
     "endpoint": "https://sg-config.YOURNAME.workers.dev",
     "logKey": "the LOG_KEY you set with wrangler"
   }
   ```

   Optional extra keys: `"extensionId"` (pin to the store-assigned ID from
   chrome://extensions instead of auto-detecting) and `"chromeDir"` (if
   Chrome's profile dir is somewhere non-standard).

4. Test it once by hand — do a couple of searches in her Chrome first:

   ```sh
   node digest.mjs
   ```

   You should see `uploaded N blocked + M searches`, and the entries at
   `GET /logs` (see `server/README.md`).

5. Install the launchd job:

   ```sh
   sed -e "s/CHILD_USERNAME/$(whoami)/g" \
       -e "s#/opt/homebrew/bin/node#$(which node)#g" \
       com.family.sg-digest.plist > ~/Library/LaunchAgents/com.family.sg-digest.plist
   launchctl load ~/Library/LaunchAgents/com.family.sg-digest.plist
   ```

   It runs nightly at 21:30 and logs to `~/sg-digest/digest.log`.

## Managing the job

All of these run on her Mac, as her macOS user.

**Is it loaded / did the last run work?**

```sh
launchctl list | grep sg-digest     # loaded? (second column is last exit code, 0 = good)
tail -20 ~/sg-digest/digest.log     # what the last run actually did
```

**Run it right now** (e.g. you want today's searches without waiting for 21:30):

```sh
launchctl kickstart gui/$(id -u)/com.family.sg-digest
# or just: cd ~/sg-digest && node digest.mjs
```

**Pause / resume it:**

```sh
launchctl unload ~/Library/LaunchAgents/com.family.sg-digest.plist   # pause
launchctl load   ~/Library/LaunchAgents/com.family.sg-digest.plist   # resume
```

**Change the schedule:** edit `Hour`/`Minute` in
`~/Library/LaunchAgents/com.family.sg-digest.plist`, then unload + load it
(launchd only reads the plist at load time). If the Mac is asleep at the
scheduled time, launchd runs the job at next wake — nothing is missed.

**Uninstall:**

```sh
launchctl unload ~/Library/LaunchAgents/com.family.sg-digest.plist
rm ~/Library/LaunchAgents/com.family.sg-digest.plist
rm -rf ~/sg-digest
```

**Rotate the LOG_KEY** (if you ever suspect it leaked): on *your* machine run
`wrangler secret put LOG_KEY` in `server/` with a new value, then update
`logKey` in `~/sg-digest/config.json` on her Mac. Old key stops working the
moment the secret updates.

**If uploads start failing:** `digest.log` will say why. The cursor in
`state.json` only advances on success, so once the cause is fixed the next
run uploads everything that accumulated — no entries are lost. (The
extension's local log caps at 2000 searches, so don't leave it broken for
months.)

## Notes

- The job copies the LevelDB before reading, so it never fights Chrome for
  the lock and works while Chrome is open.
- `state.json` tracks the last-uploaded timestamp; a failed upload is retried
  in full the next night (the cursor only advances on success).
- The `LOG_KEY` on this machine can only *append* log entries. Reading logs
  and editing the blocklist require the `ADMIN_KEY`, which never leaves your
  machine.
- If macOS prompts about disk access when you first run it by hand, grant
  Terminal (or `node`) Full Disk Access in System Settings → Privacy — some
  macOS versions gate `~/Library/Application Support` behind TCC.
