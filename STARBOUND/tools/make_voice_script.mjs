// Writes VOICE_SCRIPT.md from the game's own line table, so file names always match the game.
import { writeFileSync } from 'node:fs';
await import('../src/lines.js'); const { LINES } = await import('../src/voice.js');
const people = [['specialist', 'Lady Paula', 'Mission Specialist'], ['scientist', 'Afia', 'Principal Scientist'], ['engineer', 'Godiva', 'Spacecraft Systems Engineer'], ['ops', 'Jehielle', 'Flight Operations Lead'], ['pa', 'Public-address announcements', 'any voice']];
let md = '# STARBOUND voice recording script\n\nSave each line as its own file with exactly the file name shown (any of .mp3, .m4a, .wav), put the files in `audio/voice/`, then run `python3 tools/update_voice_manifest.py`.\n';
for (const [who, name, role] of people) { const rows = LINES.filter((l) => l.who === who); md += `\n## ${name} (${role}): ${rows.length} lines\n\n| File name | When it plays | Line |\n| --- | --- | --- |\n`; for (const r of rows) md += `| ${r.id} | ${r.when} | ${r.text.replace(/\|/g, '/')} |\n`; }
writeFileSync(new URL('../VOICE_SCRIPT.md', import.meta.url), md); console.log(LINES.length, 'lines written');
