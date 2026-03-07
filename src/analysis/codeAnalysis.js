import { parse } from '@babel/parser'

const parseOptionCandidates = [
  {
    sourceType: 'unambiguous',
    plugins: [
      'jsx',
      'typescript',
      'classProperties',
      'objectRestSpread',
      'optionalChaining',
      'decorators-legacy',
      'importAttributes',
      'dynamicImport',
    ],
  },
  {
    sourceType: 'unambiguous',
    plugins: [
      'jsx',
      'flow',
      'flowComments',
      'classProperties',
      'objectRestSpread',
      'optionalChaining',
      'decorators-legacy',
      'importAttributes',
      'dynamicImport',
    ],
  },
]

const parseWithFallback = (code) => {
  let lastError = null
  for (const options of parseOptionCandidates) {
    try {
      return parse(code, options)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError || new Error('Unable to parse code.')
}

const getNameFromPattern = (pattern) => {
  if (!pattern) return null
  if (pattern.type === 'Identifier') return pattern.name
  return null
}

const getCalleeName = (callee) => {
  if (!callee) return null
  if (callee.type === 'Identifier') return callee.name
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
    return callee.property.name
  }
  return null
}

const getArgName = (arg) => {
  if (!arg) return null
  if (arg.type === 'Identifier') return arg.name
  if (arg.type === 'MemberExpression' && arg.object?.type === 'Identifier' && !arg.computed) {
    return arg.object.name
  }
  return null
}

const createFunctionRecord = (name, params = []) => ({
  name,
  params,
  calls: new Set(),
  callSites: [],
  variables: new Set(params),
})

const ensureFunction = (functions, name, params = []) => {
  if (!functions.has(name)) {
    functions.set(name, createFunctionRecord(name, params))
  }
  return functions.get(name)
}

const getFunctionNameFromNode = (node, parent, indexHint) => {
  if (node.type === 'FunctionDeclaration') return node.id?.name || null

  if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
    if (parent?.type === 'VariableDeclarator' && parent.id?.type === 'Identifier') return parent.id.name
    if (node.id?.name) return node.id.name
    return `anonymous_${indexHint}`
  }

  return null
}

const traverse = (node, parent, currentFn, functions, counterRef) => {
  if (!node || typeof node !== 'object') return

  let nextCurrentFn = currentFn

  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression'
  ) {
    const fnName = getFunctionNameFromNode(node, parent, counterRef.count++)
    if (fnName) {
      const params = (node.params || []).map(getNameFromPattern).filter(Boolean)
      ensureFunction(functions, fnName, params)
      nextCurrentFn = fnName
    }
  }

  if (nextCurrentFn) {
    const record = ensureFunction(functions, nextCurrentFn)

    if (node.type === 'VariableDeclarator' && node.id?.type === 'Identifier') {
      record.variables.add(node.id.name)
    }

    if (node.type === 'AssignmentExpression' && node.left?.type === 'Identifier') {
      record.variables.add(node.left.name)
    }

    if (node.type === 'CallExpression') {
      const calleeName = getCalleeName(node.callee)
      if (calleeName) {
        record.calls.add(calleeName)
        record.callSites.push({
          callee: calleeName,
          args: node.arguments.map(getArgName),
        })
      }
    }
  }

  for (const key of Object.keys(node)) {
    const value = node[key]
    if (!value) continue

    if (Array.isArray(value)) {
      value.forEach((child) => {
        if (child && typeof child === 'object' && child.type) {
          traverse(child, node, nextCurrentFn, functions, counterRef)
        }
      })
      continue
    }

    if (value && typeof value === 'object' && value.type) {
      traverse(value, node, nextCurrentFn, functions, counterRef)
    }
  }
}

export const analyzeCodeStructure = (code) => {
  const trimmed = (code || '').trim()

  if (!trimmed) {
    return {
      error: 'Paste JavaScript/TypeScript code to generate call graph and data flow.',
      callGraph: { nodes: [], edges: [] },
      dataFlow: { nodes: [], edges: [] },
      functions: [],
      calls: [],
    }
  }

  if (/^https?:\/\/(www\.)?github\.com\//i.test(trimmed)) {
    return {
      error: 'GitHub URL detected. Paste the actual source code instead of a repository link.',
      callGraph: { nodes: [], edges: [] },
      dataFlow: { nodes: [], edges: [] },
      functions: [],
      calls: [],
    }
  }

  if (/^<!doctype html>|^<html/i.test(trimmed)) {
    return {
      error: 'HTML content detected. Paste JavaScript/TypeScript source code to analyze.',
      callGraph: { nodes: [], edges: [] },
      dataFlow: { nodes: [], edges: [] },
      functions: [],
      calls: [],
    }
  }

  let ast
  try {
    ast = parseWithFallback(trimmed)
  } catch (error) {
    return {
      error: `Unable to parse code: ${error.message}`,
      callGraph: { nodes: [], edges: [] },
      dataFlow: { nodes: [], edges: [] },
      functions: [],
      calls: [],
    }
  }

  const functions = new Map()
  const counterRef = { count: 1 }
  traverse(ast, null, null, functions, counterRef)

  const nodeSet = new Set(functions.keys())
  const callEdges = []
  const callEdgeSet = new Set()

  functions.forEach((record, fnName) => {
    record.calls.forEach((callee) => {
      nodeSet.add(callee)
      const key = `${fnName}->${callee}`
      if (!callEdgeSet.has(key)) {
        callEdgeSet.add(key)
        callEdges.push({ source: fnName, target: callee })
      }
    })
  })

  const dataNodes = new Set()
  const dataEdges = []
  const dataEdgeSet = new Set()

  functions.forEach((record, callerName) => {
    record.variables.forEach((varName) => dataNodes.add(`${callerName}.${varName}`))

    record.callSites.forEach((callSite) => {
      const callee = functions.get(callSite.callee)
      if (!callee) return

      callSite.args.forEach((arg, idx) => {
        if (!arg) return
        const targetParam = callee.params[idx]
        if (!targetParam) return

        const sourceNode = `${callerName}.${arg}`
        const targetNode = `${callSite.callee}.${targetParam}`
        dataNodes.add(sourceNode)
        dataNodes.add(targetNode)

        const key = `${sourceNode}->${targetNode}`
        if (!dataEdgeSet.has(key)) {
          dataEdgeSet.add(key)
          dataEdges.push({ source: sourceNode, target: targetNode })
        }
      })
    })
  })

  return {
    error: null,
    functions: Array.from(functions.keys()),
    calls: callEdges,
    callGraph: {
      nodes: Array.from(nodeSet).map((id) => ({ id })),
      edges: callEdges,
    },
    dataFlow: {
      nodes: Array.from(dataNodes).map((id) => ({ id })),
      edges: dataEdges,
    },
  }
}
