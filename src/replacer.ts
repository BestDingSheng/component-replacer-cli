import { parse } from '@babel/parser';
import generate from '@babel/generator';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import * as prettier from 'prettier';

interface ComponentReplaceRule {
  from: {
    name: string;
    property?: string;
  };
  to: string;
  importFrom: string;
}

const componentReplaceRules: ComponentReplaceRule[] = [
  { from: { name: 'Input' }, to: 'InputOutLineExt', importFrom: '@m-tools/antd-ext' },
  { from: { name: 'Select' }, to: 'SelectOutLineExt', importFrom: '@m-tools/antd-ext' },
  { from: { name: 'DatePickerExt', property: 'RangePicker' }, to: 'RangePickerOutLineExt', importFrom: '@m-tools/antd-ext' },
  { from: { name: 'EnumSelect' }, to: 'EnumSelect', importFrom: '@/BaseComponents' },
];

export async function replaceAndFormatComponents(code: string): Promise<string> {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const usedComponents: Map<string, string> = new Map();
  let hasReplacement = false;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === '@m-tools/antd-ext') {
        // We no longer need to track these separately
      }
    },
    JSXElement(path) {
      const openingElement = path.node.openingElement;

      if (t.isJSXIdentifier(openingElement.name, { name: 'FormItemExt' })) {
        const childElement = path.node.children.find(child =>
          t.isJSXElement(child)
        ) as t.JSXElement | undefined;

        if (childElement) {
          const rule = componentReplaceRules.find(r => {
            if (t.isJSXIdentifier(childElement.openingElement.name)) {
              return r.from.name === childElement.openingElement.name.name;
            } else if (t.isJSXMemberExpression(childElement.openingElement.name)) {
              return (
                t.isJSXIdentifier(childElement.openingElement.name.object) &&
                t.isJSXIdentifier(childElement.openingElement.name.property) &&
                r.from.name === childElement.openingElement.name.object.name &&
                r.from.property === childElement.openingElement.name.property.name
              );
            }
            return false;
          });

          if (rule) {
            hasReplacement = true;
            usedComponents.set(rule.to, rule.importFrom);

            const attributes = openingElement.attributes as t.JSXAttribute[];
            const labelAttr = attributes.find(attr => t.isJSXIdentifier(attr.name, { name: 'label' }));
            const newAttributes = attributes.filter(attr => !t.isJSXIdentifier(attr.name, { name: 'label' }));
            const nameAttr = newAttributes.find(attr => t.isJSXIdentifier(attr.name, { name: 'name' }));

            childElement.openingElement.name = t.jsxIdentifier(rule.to);
            if (childElement.closingElement) {
              childElement.closingElement.name = t.jsxIdentifier(rule.to);
            }

            if (labelAttr && t.isJSXAttribute(labelAttr) && labelAttr.value) {
              childElement.openingElement.attributes.push(
                t.jsxAttribute(t.jsxIdentifier('label'), labelAttr.value)
              );
            }

            openingElement.name = t.jsxMemberExpression(
              t.jsxIdentifier('Form'),
              t.jsxIdentifier('Item')
            );

            openingElement.attributes = newAttributes;

            const closingElement = path.node.closingElement;
            if (closingElement) {
              closingElement.name = t.jsxMemberExpression(
                t.jsxIdentifier('Form'),
                t.jsxIdentifier('Item')
              );
            }
          }
        }
      }
    },
  });

  const importGroups: Map<string, Set<string>> = new Map();

  usedComponents.forEach((importFrom, component) => {
    if (!importGroups.has(importFrom)) {
      importGroups.set(importFrom, new Set());
    }
    importGroups.get(importFrom)!.add(component);
  });

  importGroups.forEach((components, importFrom) => {
    const existingImport = ast.program.body.find(
      (node): node is t.ImportDeclaration =>
        t.isImportDeclaration(node) && node.source.value === importFrom
    );

    if (existingImport) {
      const existingSpecifiers = existingImport.specifiers
        .filter((specifier): specifier is t.ImportSpecifier => t.isImportSpecifier(specifier))
        .map(specifier => {
          if (t.isIdentifier(specifier.imported)) {
            return specifier.imported.name;
          } else if (t.isStringLiteral(specifier.imported)) {
            return specifier.imported.value;
          }
          return '';
        })
        .filter(Boolean);

      components.forEach(component => {
        if (!existingSpecifiers.includes(component)) {
          existingImport.specifiers.push(
            t.importSpecifier(t.identifier(component), t.identifier(component))
          );
        }
      });
    } else {
      const newSpecifiers = Array.from(components).map(component =>
        t.importSpecifier(t.identifier(component), t.identifier(component))
      );
      const newImport = t.importDeclaration(newSpecifiers, t.stringLiteral(importFrom));
      ast.program.body.unshift(newImport);
    }
  });


  if (hasReplacement) {
    const output = generate(ast, { retainLines: true, concise: false });
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
  } else {
    return code;
  }
}

