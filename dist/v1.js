"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.replaceAndFormatComponents = replaceAndFormatComponents;
const parser_1 = require("@babel/parser");
const generator_1 = __importDefault(require("@babel/generator"));
const traverse_1 = __importDefault(require("@babel/traverse"));
const t = __importStar(require("@babel/types"));
const prettier = __importStar(require("prettier"));
const componentReplaceRules = [
    { from: { name: 'Input' }, to: 'InputOutLineExt', importFrom: '@m-tools/antd-ext' },
    { from: { name: 'Select' }, to: 'SelectOutLineExt', importFrom: '@m-tools/antd-ext' },
    { from: { name: 'DatePickerExt', property: 'RangePicker' }, to: 'RangePickerOutLineExt', importFrom: '@m-tools/antd-ext' },
];
async function replaceAndFormatComponents(code) {
    const ast = (0, parser_1.parse)(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    });
    const usedComponents = new Set();
    let antdExtImport;
    let antdExtTypeImport;
    let hasReplacement = false;
    (0, traverse_1.default)(ast, {
        ImportDeclaration(path) {
            if (path.node.source.value === '@m-tools/antd-ext') {
                if (path.node.importKind === 'type') {
                    antdExtTypeImport = path;
                }
                else {
                    antdExtImport = path;
                }
            }
        },
        JSXElement(path) {
            const openingElement = path.node.openingElement;
            if (t.isJSXIdentifier(openingElement.name, { name: 'FormItemExt' })) {
                const childElement = path.node.children.find(child => t.isJSXElement(child));
                if (childElement) {
                    const rule = componentReplaceRules.find(r => {
                        if (t.isJSXIdentifier(childElement.openingElement.name)) {
                            return r.from.name === childElement.openingElement.name.name;
                        }
                        else if (t.isJSXMemberExpression(childElement.openingElement.name)) {
                            return (t.isJSXIdentifier(childElement.openingElement.name.object) &&
                                t.isJSXIdentifier(childElement.openingElement.name.property) &&
                                r.from.name === childElement.openingElement.name.object.name &&
                                r.from.property === childElement.openingElement.name.property.name);
                        }
                        return false;
                    });
                    if (rule) {
                        hasReplacement = true;
                        usedComponents.add(rule.to);
                        const attributes = openingElement.attributes;
                        const newAttributes = attributes.filter(attr => !t.isJSXIdentifier(attr.name, { name: 'label' }));
                        const nameAttr = newAttributes.find(attr => t.isJSXIdentifier(attr.name, { name: 'name' }));
                        childElement.openingElement.name = t.jsxIdentifier(rule.to);
                        if (childElement.closingElement) {
                            childElement.closingElement.name = t.jsxIdentifier(rule.to);
                        }
                        if (nameAttr) {
                            childElement.openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('label'), nameAttr.value));
                        }
                        openingElement.name = t.jsxMemberExpression(t.jsxIdentifier('Form'), t.jsxIdentifier('Item'));
                        openingElement.attributes = newAttributes;
                        const closingElement = path.node.closingElement;
                        if (closingElement) {
                            closingElement.name = t.jsxMemberExpression(t.jsxIdentifier('Form'), t.jsxIdentifier('Item'));
                        }
                    }
                }
            }
        },
    });
    if (antdExtImport && t.isImportDeclaration(antdExtImport.node)) {
        const existingSpecifiers = antdExtImport.node.specifiers
            .filter(specifier => t.isImportSpecifier(specifier))
            .map(specifier => {
            const imported = specifier.imported;
            const local = specifier.local;
            return {
                imported: t.isIdentifier(imported) ? imported.name : imported.value,
                local: local.name,
            };
        });
        const newSpecifiers = existingSpecifiers.map(spec => {
            if (usedComponents.has(spec.imported)) {
                // 如果是需要替换的组件，但有别名，保持原有结构
                return t.importSpecifier(t.identifier(spec.imported), t.identifier(spec.local));
            }
            else if (usedComponents.has(spec.local)) {
                // 如果本地名称是需要替换的组件，创建新的导入说明符
                return t.importSpecifier(t.identifier(spec.local), t.identifier(spec.local));
            }
            // 否则保持原有导入不变
            return t.importSpecifier(t.identifier(spec.imported), t.identifier(spec.local));
        });
        // 添加新使用的组件
        usedComponents.forEach(component => {
            if (!existingSpecifiers.some(spec => spec.imported === component || spec.local === component)) {
                newSpecifiers.push(t.importSpecifier(t.identifier(component), t.identifier(component)));
            }
        });
        antdExtImport.node.specifiers = newSpecifiers;
        if (newSpecifiers.length === 0) {
            antdExtImport.remove();
        }
    }
    else if (usedComponents.size > 0) {
        const newSpecifiers = Array.from(usedComponents).map(component => t.importSpecifier(t.identifier(component), t.identifier(component)));
        const newImport = t.importDeclaration(newSpecifiers, t.stringLiteral('@m-tools/antd-ext'));
        ast.program.body.unshift(newImport);
    }
    // 保持类型导入不变
    if (antdExtTypeImport && t.isImportDeclaration(antdExtTypeImport.node)) {
        // 不做任何改变，保持类型导入原样
    }
    if (hasReplacement) {
        const output = (0, generator_1.default)(ast, { retainLines: true, concise: false });
        const formattedCode = await prettier.format(output.code, {
            parser: 'typescript',
            singleQuote: true,
            trailingComma: 'es5',
            bracketSpacing: true,
            jsxBracketSameLine: false,
            semi: true,
            printWidth: 100,
        });
        return formattedCode;
    }
    else {
        return code;
    }
}
