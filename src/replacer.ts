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
];

export async function replaceAndFormatComponents(code: string): Promise<string> {
  const ast = parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  const usedComponents: Set<string> = new Set();
  let antdExtImport: NodePath<t.ImportDeclaration> | undefined;
  let antdExtTypeImport: NodePath<t.ImportDeclaration> | undefined;
  let hasReplacement = false;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === '@m-tools/antd-ext') {
        if (path.node.importKind === 'type') {
          antdExtTypeImport = path;
        } else {
          antdExtImport = path;
        }
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
            usedComponents.add(rule.to);

            const attributes = openingElement.attributes as t.JSXAttribute[];
            const newAttributes = attributes.filter(attr => !t.isJSXIdentifier(attr.name, { name: 'label' }));
            const nameAttr = newAttributes.find(attr => t.isJSXIdentifier(attr.name, { name: 'name' }));

            childElement.openingElement.name = t.jsxIdentifier(rule.to);
            if (childElement.closingElement) {
              childElement.closingElement.name = t.jsxIdentifier(rule.to);
            }

            if (nameAttr) {
              childElement.openingElement.attributes.push(
                t.jsxAttribute(t.jsxIdentifier('label'), nameAttr.value)
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

  if (antdExtImport && t.isImportDeclaration(antdExtImport.node)) {
    const existingSpecifiers = antdExtImport.node.specifiers
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

    // 只添加新的组件到导入语句中
    usedComponents.forEach(component => {
      if (!existingSpecifiers.includes(component)) {
        if (antdExtImport && antdExtImport.node) {  // Add this null check
          antdExtImport.node.specifiers.push(
            t.importSpecifier(t.identifier(component), t.identifier(component))
          );
        }
      }
    });
  } else if (usedComponents.size > 0) {
    // 如果没有现有的 @m-tools/antd-ext 导入，创建一个新的
    const newSpecifiers = Array.from(usedComponents).map(component => 
      t.importSpecifier(t.identifier(component), t.identifier(component))
    );
    const newImport = t.importDeclaration(newSpecifiers, t.stringLiteral('@m-tools/antd-ext'));
    ast.program.body.unshift(newImport);
  }

  // 保持类型导入不变
  if (antdExtTypeImport && t.isImportDeclaration(antdExtTypeImport.node)) {
    // 不做任何改变，保持类型导入原样
  }

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

