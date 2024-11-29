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
    { from: { name: 'EnumSelect' }, to: 'EnumSelect', importFrom: '@/BaseComponents' },
];
async function replaceAndFormatComponents(code) {
    const ast = (0, parser_1.parse)(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript'],
    });
    const usedComponents = new Map();
    let hasReplacement = false;
    (0, traverse_1.default)(ast, {
        ImportDeclaration(path) {
            if (path.node.source.value === '@m-tools/antd-ext') {
                // We no longer need to track these separately
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
                        usedComponents.set(rule.to, rule.importFrom);
                        const attributes = openingElement.attributes;
                        const labelAttr = attributes.find(attr => t.isJSXIdentifier(attr.name, { name: 'label' }));
                        const newAttributes = attributes.filter(attr => !t.isJSXIdentifier(attr.name, { name: 'label' }));
                        const nameAttr = newAttributes.find(attr => t.isJSXIdentifier(attr.name, { name: 'name' }));
                        childElement.openingElement.name = t.jsxIdentifier(rule.to);
                        if (childElement.closingElement) {
                            childElement.closingElement.name = t.jsxIdentifier(rule.to);
                        }
                        if (labelAttr && t.isJSXAttribute(labelAttr) && labelAttr.value) {
                            childElement.openingElement.attributes.push(t.jsxAttribute(t.jsxIdentifier('label'), labelAttr.value));
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
    const importGroups = new Map();
    usedComponents.forEach((importFrom, component) => {
        if (!importGroups.has(importFrom)) {
            importGroups.set(importFrom, new Set());
        }
        importGroups.get(importFrom).add(component);
    });
    importGroups.forEach((components, importFrom) => {
        const existingImport = ast.program.body.find((node) => t.isImportDeclaration(node) && node.source.value === importFrom);
        if (existingImport) {
            const existingSpecifiers = existingImport.specifiers
                .filter((specifier) => t.isImportSpecifier(specifier))
                .map(specifier => {
                if (t.isIdentifier(specifier.imported)) {
                    return specifier.imported.name;
                }
                else if (t.isStringLiteral(specifier.imported)) {
                    return specifier.imported.value;
                }
                return '';
            })
                .filter(Boolean);
            components.forEach(component => {
                if (!existingSpecifiers.includes(component)) {
                    existingImport.specifiers.push(t.importSpecifier(t.identifier(component), t.identifier(component)));
                }
            });
        }
        else {
            const newSpecifiers = Array.from(components).map(component => t.importSpecifier(t.identifier(component), t.identifier(component)));
            const newImport = t.importDeclaration(newSpecifiers, t.stringLiteral(importFrom));
            ast.program.body.unshift(newImport);
        }
    });
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
