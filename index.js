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


function main() {
    const debug = false;
	let code = fs.readFileSync(process.argv[2]).toString();
	let lines = code.split("\n").map(line => line.trim()).filter(l => l);
	const {labels, inst, directives} = parse(lines);
    const memory = new Array(1000);
    const REGISTERS = {
        rdi: null, rsi: null, rsp: memory.length-1, rbp: 0x00, 
        rax: null, rbx: null, rcx: null, rdx: null, rip: labels.main.index, r8: null,
        r9: null, r10: null, r11: null, r12: null, r13: null, r14: null, r15: null,
        cs: null, ds: null, fs: null, ss: null, es: null, gs: null, cf: null,
        zf: null, pf: null, af: null, sf: null, tf: null, if: null, df: null, of: null,
    };

    memory[memory.length] = null;
    do {
        const instruction = inst[REGISTERS.rip++];
        if (debug) {
            console.log(instruction);
            console.log(memory);
            console.log(REGISTERS);
        }
        switch(instruction.operation) {
            case "pushq":
                const reg = instruction.operands[0];
                memory[REGISTERS.rsp] = REGISTERS[reg];
                REGISTERS.rsp--;
                break;
            case "movq":
                {
                    const operand = instruction.operands[0];
                    if (REGISTERS[operand] !== undefined) {
                        // register to register
                        const reg = instruction.operands[1];
                        REGISTERS[reg] = REGISTERS[operand]; 
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
                            memory[REGISTERS[reg] + parseInt(offset)] = d;
                            break;
                        }
                        REGISTERS[secondOperand] = d;
                    } else if (operand.includes("(")) {
                            const rhr = instruction.operands[1];
                            const offset = operand.substring(0, operand.indexOf("("));
                            const lhr = operand.substring(
                                operand.indexOf("(")+1, operand.indexOf(")")
                            );
                            REGISTERS[rhr] = memory[REGISTERS[lhr] + parseInt(offset)];
                    } else {
                        // constant to register
                        const reg = instruction.operands[1];
                        REGISTERS[reg] = operand; 
                    }
                    break;
                }
            case "subq":
                {
                    const operand = instruction.operands[0];
                    if (REGISTERS[operand] !== undefined) {
                        // register to register
                        const reg = instruction.operands[1];
                        REGISTERS[reg] -= REGISTERS[operand]; 
                    }
                    else {
                        // constant to register
                        const reg = instruction.operands[1];
                        REGISTERS[reg] -= operand;
                    }
                }
                break;
            case "popq":
                {
                    const reg = instruction.operands[0];
                    REGISTERS[reg] = memory[++REGISTERS.rsp]; 
                }
                break;
            case "call":
                {
                    const func = instruction.operands[0];
                    const label = labels[func];
                    if (label) {
                        // push to stack
                        memory[REGISTERS.rsp] = REGISTERS.rip;
                        REGISTERS.rsp--;
                        REGISTERS.rip = label.index;
                    }
                    if (func === "puts") {
                        puts(REGISTERS.rdi);
                    }
                }
                break;
            case "leave":
                {
                    REGISTERS.rsp = REGISTERS.rbp;
                    // equivalent to pop
                    REGISTERS.rsp++;
                    REGISTERS.rbp = memory[REGISTERS.rsp];
                }
                break;
            case "ret":
                {
                    // equivalent to pop
                    const parentSubroutine = memory[++REGISTERS.rsp];
                    // then jump
                    REGISTERS.rip = parentSubroutine;
                }
                break;
            default:
                console.log("unknown instruction", instruction);
                break;
        }

    } while(REGISTERS.rip !== null && REGISTERS.rip !== inst.length)
}

function puts(rdi) {
    console.log(rdi);
}

main();
