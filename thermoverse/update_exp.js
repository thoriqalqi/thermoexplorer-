const fs = require('fs');

const txt = fs.readFileSync('pembahasan3.txt', 'utf8');
const config = require('./level3_config.json');

// We have 4 challenges: ct, st, sci, inn
// The text contains exactly 19 questions in order: 6 for CT, 4 for ST, 4 for SCI, 5 for INN.

// Let's use a regex to match each question block
// A question block starts with: \n\d+\.\t?\(
// and ends either before the next question, or EOF.
const qRegex = /\d+\.\s*\((.*?)\)\s*([\s\S]*?)\n\s*A\.\s*([\s\S]*?)\n\s*B\.\s*([\s\S]*?)\n\s*C\.\s*([\s\S]*?)\n\s*D\.\s*([\s\S]*?)\n\s*E\.\s*([\s\S]*?)\n\s*Kunci(?: Jawaban)?:\s*([A-E])\s*\n\s*Pembahasan(?: Sistemik)?:\s*([\s\S]*?)(?=\n\d+\.\s*\(|\nTantangan|$)/g;

let matches = [...txt.matchAll(qRegex)];

console.log(`Found ${matches.length} questions in the text.`);

if(matches.length !== 19) {
  console.log("Error: Expected exactly 19 questions.");
  // Let's try to print where it failed or just print all matches
  matches.forEach((m, i) => console.log(`Q${i+1}: ${m[1]}`));
  process.exit(1);
}

const mapIndexToKey = (idx) => {
  if(idx < 6) return { k: 'ct', i: idx };
  if(idx < 10) return { k: 'st', i: idx - 6 };
  if(idx < 14) return { k: 'sci', i: idx - 10 };
  return { k: 'inn', i: idx - 14 };
};

const xpMap = {
  'interpretasi':15, 'analisis':20, 'evaluasi':25, 'penjelasan':20,
  'pemahaman':20, 'analisis sistem':25, 'analisis & evaluasi':25,
  'inkuiri':15, 'inquiry':15, 'inquiry & hypothesis':20, 'analysis & argumentation':25, 'analysis':25,
  'fleksibilitas':20, 'flexibility':20, 'kreatif':30, 'creative':30, 'mengidentifikasi':20, 'kelancaran':15, 'merumuskan hipotesis':20
};

const getXP = (ind) => {
  const key = ind.toLowerCase();
  for(const k in xpMap){ if(key.includes(k)) return xpMap[k]; }
  return 15;
};

matches.forEach((m, idx) => {
  const { k, i } = mapIndexToKey(idx);
  
  const ind = m[1].trim();
  const qText = m[2].trim();
  const a = [ m[3].trim(), m[4].trim(), m[5].trim(), m[6].trim(), m[7].trim() ];
  const cLetter = m[8].trim();
  const c = cLetter.charCodeAt(0) - 65;
  const p = m[9].trim();
  
  config.challenges[k].questions[i] = {
    ind,
    xp: getXP(ind),
    q: qText,
    a,
    c,
    p
  };
});

let html = fs.readFileSync('level3.html', 'utf8');

// Serialize config
const jsonStr = JSON.stringify(config, null, 2);

html = html.replace(/window\.LEVEL_CONFIG = \{[\s\S]+?\};\s*<\/script>/, `window.LEVEL_CONFIG = ${jsonStr};\n</script>`);

fs.writeFileSync('level3.html', html);
console.log('Successfully updated level3.html with new questions and pembahasan.');
