// Offline fallback bank used when Gemini is unavailable.
// Each entry: [question, [4 options], correctIndex, explanation]
const bank = {
  javascript: [
    ['Which keyword declares a block-scoped variable that can be reassigned?', ['var', 'let', 'const', 'static'], 1, '`let` is block-scoped and reassignable; `const` cannot be reassigned.'],
    ['What does `typeof null` return?', ['"null"', '"undefined"', '"object"', '"number"'], 2, 'A long-standing quirk: `typeof null` is "object".'],
    ['Which method adds an element to the end of an array?', ['push()', 'pop()', 'shift()', 'unshift()'], 0, '`push()` appends; `pop()` removes from the end.'],
    ['What does `===` check?', ['Value only', 'Type only', 'Value and type', 'Reference only'], 2, 'Strict equality compares both value and type without coercion.'],
    ['Which of these creates a Promise that resolves immediately?', ['Promise.resolve()', 'Promise.wait()', 'Promise.now()', 'Promise.done()'], 0, '`Promise.resolve(value)` returns an already-resolved promise.'],
    ['What is a closure?', ['A function bundled with its surrounding scope', 'A way to close a browser tab', 'A loop that never ends', 'A private class field'], 0, 'A closure lets a function keep access to variables from the scope where it was created.'],
  ],
  'general knowledge': [
    ['What is the capital of Australia?', ['Sydney', 'Melbourne', 'Canberra', 'Perth'], 2, 'Canberra is the capital, chosen as a compromise between Sydney and Melbourne.'],
    ['How many continents are there?', ['5', '6', '7', '8'], 2, 'The usual convention counts seven continents.'],
    ['Which language has the most native speakers?', ['English', 'Mandarin Chinese', 'Spanish', 'Hindi'], 1, 'Mandarin Chinese has the most native speakers.'],
    ['In which sport would you perform a slam dunk?', ['Volleyball', 'Tennis', 'Basketball', 'Golf'], 2, 'A slam dunk is a basketball shot made by jumping and putting the ball directly through the hoop.'],
    ['Which planet is known as the Red Planet?', ['Venus', 'Mars', 'Jupiter', 'Mercury'], 1, 'Iron oxide on its surface gives Mars its red colour.'],
    ['How many strings does a standard guitar have?', ['4', '5', '6', '7'], 2, 'A standard guitar has six strings.'],
  ],
  science: [
    ['What is the chemical symbol for water?', ['H2O', 'CO2', 'O2', 'NaCl'], 0, 'Water is two hydrogen atoms bonded to one oxygen atom.'],
    ['What gas do plants absorb for photosynthesis?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], 2, 'Plants take in CO2 and release oxygen.'],
    ['What is the powerhouse of the cell?', ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'], 1, 'Mitochondria produce most of the cell\'s ATP.'],
    ['What is the approximate speed of light?', ['300,000 km/s', '30,000 km/s', '3,000 km/s', '3,000,000 km/s'], 0, 'Light travels at roughly 299,792 km/s in a vacuum.'],
    ['Which force keeps planets in orbit around the Sun?', ['Magnetism', 'Friction', 'Gravity', 'Nuclear force'], 2, 'Gravity keeps planets in orbit.'],
    ['What is the hardest natural substance?', ['Gold', 'Iron', 'Quartz', 'Diamond'], 3, 'Diamond is the hardest naturally occurring material.'],
  ],
  history: [
    ['In which year did World War II end?', ['1943', '1945', '1947', '1950'], 1, 'WWII ended in 1945.'],
    ['Who was the first President of the United States?', ['Abraham Lincoln', 'Thomas Jefferson', 'George Washington', 'John Adams'], 2, 'George Washington served from 1789 to 1797.'],
    ['Which civilization built Machu Picchu?', ['Aztec', 'Maya', 'Inca', 'Olmec'], 2, 'Machu Picchu was built by the Inca in the 15th century.'],
    ['The Berlin Wall fell in which year?', ['1979', '1985', '1989', '1991'], 2, 'The wall fell on 9 November 1989.'],
    ['Who led India\'s non-violent independence movement?', ['Subhas Chandra Bose', 'Mahatma Gandhi', 'Bhagat Singh', 'B. R. Ambedkar'], 1, 'Mahatma Gandhi led campaigns of non-violent civil disobedience.'],
    ['Which empire was ruled by Julius Caesar?', ['Ottoman', 'Roman', 'Byzantine', 'Persian'], 1, 'Caesar was a Roman general and statesman.'],
  ],
  geography: [
    ['What is the longest river in the world by most measures?', ['Amazon', 'Nile', 'Yangtze', 'Mississippi'], 1, 'The Nile is traditionally cited as the longest, at about 6,650 km.'],
    ['Which is the largest ocean?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3, 'The Pacific covers about a third of Earth\'s surface.'],
    ['Mount Everest lies on the border of Nepal and which country?', ['India', 'China', 'Bhutan', 'Pakistan'], 1, 'Everest sits on the Nepal–China (Tibet) border.'],
    ['What is the smallest country by area?', ['Monaco', 'Vatican City', 'San Marino', 'Liechtenstein'], 1, 'Vatican City is about 0.44 km².'],
    ['Which desert is the largest hot desert?', ['Gobi', 'Kalahari', 'Sahara', 'Thar'], 2, 'The Sahara is the largest hot desert.'],
    ['Which country has the most time zones (including territories)?', ['Russia', 'USA', 'France', 'China'], 2, 'France has the most because of its overseas territories.'],
  ],
};

const fallbackTopic = 'general knowledge';

function pickBank(topicKey) {
  const key = Object.keys(bank).find((k) => topicKey.includes(k) || k.includes(topicKey));
  return bank[key ?? fallbackTopic];
}

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

export function seedQuestionsFor(topicKey, count) {
  // matching topic first, topped up from the other banks for larger quizzes
  const primary = pickBank(topicKey);
  const rest = Object.values(bank).filter((b) => b !== primary).flat();
  const pool = [...shuffle(primary), ...shuffle(rest)];
  return pool.slice(0, count).map(([text, options, correctIndex, explanation]) => ({
    text,
    options,
    correctIndex,
    explanation,
  }));
}
