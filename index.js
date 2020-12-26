const fs = require("fs");


class Directive {
    constructor(name,  value) {
        this.name = name;
        this.value = value;
    }
}

class Label {
    constructor(index, name) {
        this.index = index;
        this.name = name;
    }
}

const parse = code => {
    const directives = {};
    const labels = {};
    const inst = [];
    for (let i = 0; i < code.length; i++) {
        const line = code[i];
        if (line.startsWith(".")) {
            if(line != ".global main" && line != ".text") {
                const value = code[++i];
                const name = line.slice(0, line.length-1)
                directives[name] = new Directive(name, value.slice(value.indexOf("\"")+1, value.length-1));
            }
            continue;
        }
        if (line.includes(":")) {
            const val = line.slice(0, line.length-1);
            labels[val] = new Label(inst.length, val);
            continue;
        }


        // parse an instruction
        const operation = line.split(/\s/)[0].toLowerCase();
        let operands = line.substring(operation.length).split(',').map(t => {
            let operand = t.trim();
            if (operand.includes("%")) {
                operand = operand.replace("%", "");
            }

            if (operand.includes("$")) {
                operand = operand.replace("$", "");
            }
            return operand;
        });
        operands = operands[0] ? operands : null;
        inst.push({operation, operands});
    }
    return {labels, inst, directives} ;
}

class Process {
    constructor(instructions, labels, directives, memSize) {
        this.instructions = instructions;
        this.labels = labels;
        this.directives = directives;
        this.memory = new Array(memSize);
        this.memSize = memSize;
        // we need this so that when we pop the last pointer to jump to when main is done
        this.memory[memSize] = null;
        this.REGISTERS = {
            rdi: null, rsi: null, rsp: memSize-1, rbp: 0x00,
            rax: null, rbx: null, rcx: null, rdx: null, rip: labels.main.index, r8: null,
            r9: null, r10: null, r11: null, r12: null, r13: null, r14: null, r15: null,
            cs: null, ds: null, fs: null, ss: null, es: null, gs: null, cf: null,
            zf: null, pf: null, af: null, sf: null, tf: null, if: null, df: null, of: null,
        };
    }

    getLabel(name) {
        return this.labels[name];
    }

    /*
     * @ return current instruction and increamnet RIP
     */
    nextInstruction() {
        return this.instructions[this.REGISTERS.rip++];
    }

    isNextInstruction() {
        return (this.REGISTERS.rip !== null && this.REGISTERS.rip !== this.instructions.length);
    }

    memSet(offset, val) {
        this.memory[offset] = val;
    }

    pop(reg) {
        this.decRSP();
        this.REGISTERS[reg] = this.memory[this.REGISTERS.rsp];
    }

    push(val) {
        this.memory[this.REGISTERS.rsp] = val;
        this.incRSP();
    }

    incRSP(amount=1) {
        this.REGISTERS.rsp -= amount;
    }

    decRSP(amount=1) {
        this.REGISTERS.rsp += amount;
    }

    regSet(reg, val) {
        this.REGISTERS[reg] = val;
    }

}

function main() {
    const debug = false;
	let code = fs.readFileSync(process.argv[2]).toString();
	let lines = code.split("\n").map(line => line.trim()).filter(l => l);
	const {labels, inst, directives} = parse(lines);
    const mprocess = new Process(inst, labels, directives, 1000);
    do {
        const instruction = mprocess.nextInstruction();
        switch(instruction.operation) {
            case "pushq":
                {
                    const reg = instruction.operands[0];
                    mprocess.push(mprocess.REGISTERS[reg]);
                }
                break;
            case "movq":
                {
                    const operand = instruction.operands[0];
                    if (mprocess.REGISTERS[operand] !== undefined) {
                        // register to register
                        const reg = instruction.operands[1];
                        mprocess.regSet(reg, mprocess.REGISTERS[operand]);
                    }
                    else if (operand.startsWith(".")) {
                        // directive to memory
                        const d = directives[operand].value;
                        const secondOperand = instruction.operands[1];
                        if (secondOperand.includes("(")) {
                            const offset = secondOperand.substring(0, secondOperand.indexOf("("));
                            const reg = secondOperand.substring(
                                secondOperand.indexOf("(")+1, secondOperand.indexOf(")")
                            );
                            mprocess.memSet(mprocess.REGISTERS[reg] + parseInt(offset), d);
                            break;
                        }
                        mprocess.regSet(secondOperand, d);
                    }
                    else if (operand.includes("(")) {
                        // memory with offset to register
                        const rhr = instruction.operands[1];
                        const offset = operand.substring(0, operand.indexOf("("));
                        const lhr = operand.substring(
                            operand.indexOf("(")+1, operand.indexOf(")")
                        );
                        mprocess.regSet(rhr, mprocess.memory[mprocess.REGISTERS[lhr] + parseInt(offset)]);
                    }
                    else {
                        // Immediate to register
                        const reg = instruction.operands[1];
                        mprocess.regSet(reg, operand);
                    }
                }
                break;
            case "subq":
                {
                    const operand = instruction.operands[0];
                    const reg = instruction.operands[1];
                    if (mprocess.REGISTERS[operand] !== undefined) {
                        // register to register
                        mprocess.REGISTERS[reg] -= mprocess.REGISTERS[operand];
                    }
                    else {
                        // constant to register
                        mprocess.REGISTERS[reg] -= operand;
                    }
                }
                break;
            case "popq":
                {
                    const reg = instruction.operands[0];
                    mprocess.pop(reg);
                }
                break;
            case "call":
                {
                    const func = instruction.operands[0];
                    const label = mprocess.getLabel(func);
                    if (label) {
                        mprocess.push(mprocess.REGISTERS.rip);
                        mprocess.regSet("rip", label.index);
                    }
                    if (func === "puts") {
                        puts(mprocess.REGISTERS.rdi);
                    }
                }
                break;
            case "leave":
                {
                    mprocess.regSet("rsp", mprocess.REGISTERS.rbp);
                    mprocess.pop("rbp");
                }
                break;
            case "ret":
                {
                    // equivalent to pop then jump
                    mprocess.pop("rip");
                }
                break;
            default:
                console.log("unknown instruction", instruction);
                break;
        }

        if (debug) {
            console.log(instruction);
            console.log(mprocess.memory);
            console.log(mprocess.REGISTERS);
        }
    } while(mprocess.isNextInstruction());
}

function puts(rdi) {
    console.log(rdi);
}

main();
