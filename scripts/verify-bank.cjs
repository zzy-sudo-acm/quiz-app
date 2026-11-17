const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const context = vm.createContext({document: {}, console});
vm.runInContext(source.slice(0, source.lastIndexOf('\ndocument.querySelectorAll("[data-mode]")')), context);
const bank = JSON.parse(fs.readFileSync(path.join(root, 'questions.json'), 'utf8'));
context.bank = bank;
assert.equal(vm.runInContext('validateBank(bank).length', context), 104);
assert.equal(bank.filter(q=>q.type==='multiple').length, 19);
assert.equal(new Set(bank.map(q=>q.id)).size, 104);
for(const q of bank){
  assert.ok(q.source && q.page && q.year && q.explanation && q.answerSource);
  assert.equal(q.options.length,4);
  assert.ok(!q.options.some(o=>/阅卷人|适用专业|论述题|材料分析题/.test(o.text)));
}
for (const expression of [
  'validateBank([])',
  'validateBank([bank[0],bank[0]])',
  'validateBank([{...bank[0],answer:["Z"]}])',
  'validateBank([{...bank[0],type:"multiple"}])',
  'validateBank([{...bank[0],question:""}])',
  'validateBank([{...bank[0],options:[bank[0].options[0],bank[0].options[0]]}])'
]) assert.throws(()=>vm.runInContext(expression,context));
assert.equal(vm.runInContext('equalAnswers(["B","A"],["A","B"])',context),true);
assert.equal(vm.runInContext('equalAnswers(["A"],["A","B"])',context),false);
assert.equal(vm.runInContext('new Set(shuffle(bank.map(q=>q.id))).size',context),104);
assert.equal(vm.runInContext('fingerprint(bank)===fingerprint(validateBank(bank))',context),true);
const cloud = JSON.parse(fs.readFileSync(path.join(root, 'cloud-questions.json'), 'utf8'));
context.cloud = cloud;
assert.equal(vm.runInContext('validateBank(cloud).length', context), 91);
assert.deepEqual(cloud.filter(q => q.answer.length === 0).map(q => q.id), [6]);
assert.equal(cloud[5].answerStatus, 'ungraded');
assert.throws(() => vm.runInContext('validateBank([{...cloud[5], answerStatus: "reference"}])', context));
assert.throws(() => vm.runInContext('validateBank([{...cloud[5], answer: ["A"]}])', context));

console.log('PASS: 104 Mayuan questions, 91 cloud questions, ungraded question, schema and grading checks.');
