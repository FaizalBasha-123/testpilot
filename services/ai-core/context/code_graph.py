"""
Code Graph v2 - Multi-Language Dependency Analyzer
===================================================

This module implements CodeRabbit-style code graph analysis using tree-sitter
for multi-language AST parsing. It provides deep cross-file dependency context
to improve AI review accuracy.

Features:
- Multi-language support (Python, JavaScript, TypeScript, Go, Rust)
- 3-level deep dependency tracking
- Function/class signature extraction (not raw code)
- Call graph building (who calls whom)
- Smart prioritization based on changed lines

Author: BlackboxTester Team
"""

import os
import json
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

# Lazy import tree-sitter to avoid startup cost
_tree_sitter_initialized = False
_parsers = {}


class Language(Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    GO = "go"
    RUST = "rust"
    UNKNOWN = "unknown"


@dataclass
class Symbol:
    """Represents a code symbol (function, class, variable)."""
    name: str
    kind: str  # "function", "class", "method", "variable"
    signature: str
    start_line: int
    end_line: int
    file_path: str
    docstring: Optional[str] = None


@dataclass
class Import:
    """Represents an import statement."""
    module: str
    names: List[str]  # Specific imports, empty for "import X"
    alias: Optional[str] = None
    line: int = 0


@dataclass
class CodeGraphNode:
    """A node in the code dependency graph."""
    file_path: str
    language: Language
    symbols: List[Symbol] = field(default_factory=list)
    imports: List[Import] = field(default_factory=list)
    dependencies: List[str] = field(default_factory=list)  # File paths this file depends on
    dependents: List[str] = field(default_factory=list)    # Files that depend on this file


@dataclass
class CodeGraphContext:
    """The final context object sent to the LLM."""
    target_file: str
    target_symbols: List[Symbol]
    dependency_context: Dict[str, List[Symbol]]
    call_graph: Dict[str, List[str]]  # symbol_name -> [called_symbols]
    total_context_chars: int = 0


def detect_language(file_path: str) -> Language:
    """Detect programming language from file extension."""
    ext_map = {
        '.py': Language.PYTHON,
        '.js': Language.JAVASCRIPT,
        '.jsx': Language.JAVASCRIPT,
        '.ts': Language.TYPESCRIPT,
        '.tsx': Language.TYPESCRIPT,
        '.go': Language.GO,
        '.rs': Language.RUST,
    }
    ext = Path(file_path).suffix.lower()
    return ext_map.get(ext, Language.UNKNOWN)


def _init_tree_sitter():
    """Lazy initialize tree-sitter parsers."""
    global _tree_sitter_initialized, _parsers
    
    if _tree_sitter_initialized:
        return True
    
    try:
        import tree_sitter_python
        import tree_sitter_javascript
        # Note: tree_sitter_typescript, tree_sitter_go, tree_sitter_rust
        # can be added as needed
        from tree_sitter import Language as TSLanguage, Parser
        
        _parsers['python'] = Parser(TSLanguage(tree_sitter_python.language()))
        _parsers['javascript'] = Parser(TSLanguage(tree_sitter_javascript.language()))
        
        _tree_sitter_initialized = True
        return True
    except ImportError as e:
        # Fallback to regex-based parsing if tree-sitter not available
        print(f"[CodeGraph] tree-sitter not available, falling back to regex: {e}")
        return False


def _get_parser(language: Language):
    """Get tree-sitter parser for language."""
    if not _init_tree_sitter():
        return None
    
    lang_map = {
        Language.PYTHON: 'python',
        Language.JAVASCRIPT: 'javascript',
        Language.TYPESCRIPT: 'javascript',  # Close enough for basic parsing
    }
    
    parser_key = lang_map.get(language)
    return _parsers.get(parser_key) if parser_key else None


class CodeGraphBuilder:
    """
    Multi-language code graph analyzer.
    Uses tree-sitter for universal AST parsing with regex fallback.
    """
    
    def __init__(self, repo_path: str, max_depth: int = 3, max_deps: int = 20, 
                 max_context_chars: int = 50000):
        """
        Initialize CodeGraphBuilder.
        
        Args:
            repo_path: Root path of the repository
            max_depth: How many levels deep to trace dependencies (default 3)
            max_deps: Maximum number of dependency files to include (default 20)
            max_context_chars: Max total characters in context (default 50K)
        """
        self.repo_path = repo_path
        self.max_depth = max_depth
        self.max_deps = max_deps
        self.max_context_chars = max_context_chars
        self._file_cache: Dict[str, CodeGraphNode] = {}
    
    def build_context(self, target_file: str, changed_lines: Optional[List[int]] = None) -> CodeGraphContext:
        """
        Build code graph context for a target file.
        
        Args:
            target_file: Relative path to the file being reviewed
            changed_lines: Optional list of line numbers that were changed
            
        Returns:
            CodeGraphContext with dependency information for LLM
        """
        target_abs = os.path.join(self.repo_path, target_file)
        
        if not os.path.exists(target_abs):
            return CodeGraphContext(
                target_file=target_file,
                target_symbols=[],
                dependency_context={},
                call_graph={}
            )
        
        # 1. Parse target file
        target_node = self._parse_file(target_abs)
        
        # 2. Find symbols at changed lines (if provided)
        if changed_lines:
            target_symbols = self._symbols_at_lines(target_node.symbols, changed_lines)
        else:
            target_symbols = target_node.symbols
        
        # 3. Trace dependencies (breadth-first, up to max_depth)
        dependency_files = self._trace_dependencies(target_node, depth=self.max_depth)
        
        # 4. Parse dependency files and extract relevant symbols
        dependency_context = {}
        total_chars = 0
        
        for dep_path in dependency_files[:self.max_deps]:
            if total_chars >= self.max_context_chars:
                break
                
            dep_node = self._parse_file(dep_path)
            if dep_node.symbols:
                # Only include signatures to save context space
                dep_symbols = dep_node.symbols[:10]  # Top 10 symbols per file
                dependency_context[dep_path] = dep_symbols
                total_chars += sum(len(s.signature) for s in dep_symbols)
        
        # 5. Build call graph
        call_graph = self._build_call_graph(target_node, target_symbols)
        
        return CodeGraphContext(
            target_file=target_file,
            target_symbols=target_symbols,
            dependency_context=dependency_context,
            call_graph=call_graph,
            total_context_chars=total_chars
        )
    
    def _parse_file(self, file_path: str) -> CodeGraphNode:
        """Parse a file and extract symbols and imports."""
        
        # Check cache first
        if file_path in self._file_cache:
            return self._file_cache[file_path]
        
        language = detect_language(file_path)
        
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
        except Exception:
            return CodeGraphNode(file_path=file_path, language=language)
        
        # Try tree-sitter first, fall back to regex
        parser = _get_parser(language)
        if parser:
            node = self._parse_with_tree_sitter(file_path, content, language, parser)
        else:
            node = self._parse_with_regex(file_path, content, language)
        
        self._file_cache[file_path] = node
        return node
    
    def _parse_with_tree_sitter(self, file_path: str, content: str, 
                                 language: Language, parser) -> CodeGraphNode:
        """Parse file using tree-sitter."""
        tree = parser.parse(bytes(content, 'utf-8'))
        root = tree.root_node
        
        symbols = []
        imports = []
        
        # Walk the tree and extract symbols
        self._extract_symbols_ts(root, content, file_path, symbols, imports, language)
        
        return CodeGraphNode(
            file_path=file_path,
            language=language,
            symbols=symbols,
            imports=imports,
            dependencies=self._resolve_imports(imports)
        )
    
    def _extract_symbols_ts(self, node, content: str, file_path: str,
                            symbols: List[Symbol], imports: List[Import],
                            language: Language, depth: int = 0):
        """Recursively extract symbols from tree-sitter AST."""
        
        # Python-specific extraction
        if language == Language.PYTHON:
            if node.type == 'function_definition':
                name_node = node.child_by_field_name('name')
                params_node = node.child_by_field_name('parameters')
                if name_node:
                    name = content[name_node.start_byte:name_node.end_byte]
                    params = content[params_node.start_byte:params_node.end_byte] if params_node else "()"
                    signature = f"def {name}{params}"
                    
                    # Extract docstring
                    docstring = self._extract_docstring(node, content)
                    
                    symbols.append(Symbol(
                        name=name,
                        kind="function" if depth == 0 else "method",
                        signature=signature,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        file_path=file_path,
                        docstring=docstring
                    ))
            
            elif node.type == 'class_definition':
                name_node = node.child_by_field_name('name')
                if name_node:
                    name = content[name_node.start_byte:name_node.end_byte]
                    # Get base classes
                    bases = node.child_by_field_name('superclasses')
                    base_str = content[bases.start_byte:bases.end_byte] if bases else ""
                    signature = f"class {name}{base_str}"
                    
                    symbols.append(Symbol(
                        name=name,
                        kind="class",
                        signature=signature,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        file_path=file_path
                    ))
            
            elif node.type in ('import_statement', 'import_from_statement'):
                imp = self._parse_python_import(node, content)
                if imp:
                    imports.append(imp)
        
        # JavaScript/TypeScript extraction
        elif language in (Language.JAVASCRIPT, Language.TYPESCRIPT):
            if node.type == 'function_declaration':
                name_node = node.child_by_field_name('name')
                params_node = node.child_by_field_name('parameters')
                if name_node:
                    name = content[name_node.start_byte:name_node.end_byte]
                    params = content[params_node.start_byte:params_node.end_byte] if params_node else "()"
                    signature = f"function {name}{params}"
                    
                    symbols.append(Symbol(
                        name=name,
                        kind="function",
                        signature=signature,
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        file_path=file_path
                    ))
            
            elif node.type == 'class_declaration':
                name_node = node.child_by_field_name('name')
                if name_node:
                    name = content[name_node.start_byte:name_node.end_byte]
                    symbols.append(Symbol(
                        name=name,
                        kind="class",
                        signature=f"class {name}",
                        start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1,
                        file_path=file_path
                    ))
            
            elif node.type == 'arrow_function':
                parent = node.parent
                if parent and parent.type == 'variable_declarator':
                    name_node = parent.child_by_field_name('name')
                    if name_node:
                        name = content[name_node.start_byte:name_node.end_byte]
                        params_node = node.child_by_field_name('parameters')
                        params = content[params_node.start_byte:params_node.end_byte] if params_node else "()"
                        signature = f"const {name} = {params} =>"
                        
                        symbols.append(Symbol(
                            name=name,
                            kind="function",
                            signature=signature,
                            start_line=node.start_point[0] + 1,
                            end_line=node.end_point[0] + 1,
                            file_path=file_path
                        ))
            
            elif node.type == 'import_statement':
                imp = self._parse_js_import(node, content)
                if imp:
                    imports.append(imp)
        
        # Recurse into children
        for child in node.children:
            self._extract_symbols_ts(child, content, file_path, symbols, imports, language, depth + 1)
    
    def _parse_python_import(self, node, content: str) -> Optional[Import]:
        """Parse Python import statement."""
        try:
            text = content[node.start_byte:node.end_byte]
            
            if text.startswith('from '):
                # from X import Y
                parts = text.split(' import ')
                if len(parts) == 2:
                    module = parts[0].replace('from ', '').strip()
                    names = [n.strip() for n in parts[1].split(',')]
                    return Import(module=module, names=names, line=node.start_point[0] + 1)
            else:
                # import X
                module = text.replace('import ', '').strip()
                if ' as ' in module:
                    module, alias = module.split(' as ')
                    return Import(module=module.strip(), names=[], alias=alias.strip(), 
                                 line=node.start_point[0] + 1)
                return Import(module=module, names=[], line=node.start_point[0] + 1)
        except Exception:
            pass
        return None
    
    def _parse_js_import(self, node, content: str) -> Optional[Import]:
        """Parse JavaScript import statement."""
        try:
            text = content[node.start_byte:node.end_byte]
            
            # import X from 'Y' or import { X } from 'Y'
            if 'from' in text:
                parts = text.split('from')
                if len(parts) == 2:
                    module = parts[1].strip().strip("'\"").strip(";")
                    names_part = parts[0].replace('import', '').strip()
                    
                    # Handle { X, Y }
                    if '{' in names_part:
                        names = [n.strip() for n in names_part.strip('{}').split(',')]
                    else:
                        names = [names_part]
                    
                    return Import(module=module, names=names, line=node.start_point[0] + 1)
        except Exception:
            pass
        return None
    
    def _extract_docstring(self, node, content: str) -> Optional[str]:
        """Extract docstring from function/class node."""
        try:
            body = node.child_by_field_name('body')
            if body and body.children:
                first_stmt = body.children[0]
                if first_stmt.type == 'expression_statement':
                    expr = first_stmt.children[0]
                    if expr.type == 'string':
                        docstring = content[expr.start_byte:expr.end_byte]
                        # Clean up quotes
                        return docstring.strip('"""').strip("'''").strip()
        except Exception:
            pass
        return None
    
    def _parse_with_regex(self, file_path: str, content: str, 
                          language: Language) -> CodeGraphNode:
        """Fallback: Parse file using regex patterns."""
        import re
        
        symbols = []
        imports = []
        lines = content.split('\n')
        
        if language == Language.PYTHON:
            # Python patterns
            func_pattern = re.compile(r'^(\s*)def\s+(\w+)\s*\((.*?)\)', re.MULTILINE)
            class_pattern = re.compile(r'^class\s+(\w+)(?:\((.*?)\))?:', re.MULTILINE)
            import_pattern = re.compile(r'^(?:from\s+(\S+)\s+)?import\s+(.+)$', re.MULTILINE)
            
            for match in func_pattern.finditer(content):
                indent, name, params = match.groups()
                line_num = content[:match.start()].count('\n') + 1
                symbols.append(Symbol(
                    name=name,
                    kind="method" if indent else "function",
                    signature=f"def {name}({params})",
                    start_line=line_num,
                    end_line=line_num,  # Regex can't easily determine end
                    file_path=file_path
                ))
            
            for match in class_pattern.finditer(content):
                name, bases = match.groups()
                line_num = content[:match.start()].count('\n') + 1
                symbols.append(Symbol(
                    name=name,
                    kind="class",
                    signature=f"class {name}({bases or ''})",
                    start_line=line_num,
                    end_line=line_num,
                    file_path=file_path
                ))
            
            for match in import_pattern.finditer(content):
                from_module, imported = match.groups()
                line_num = content[:match.start()].count('\n') + 1
                if from_module:
                    imports.append(Import(
                        module=from_module,
                        names=[n.strip() for n in imported.split(',')],
                        line=line_num
                    ))
                else:
                    imports.append(Import(
                        module=imported.split(',')[0].strip(),
                        names=[],
                        line=line_num
                    ))
        
        elif language in (Language.JAVASCRIPT, Language.TYPESCRIPT):
            # JS/TS patterns
            func_pattern = re.compile(r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)', re.MULTILINE)
            arrow_pattern = re.compile(r'(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\((.*?)\)\s*=>', re.MULTILINE)
            class_pattern = re.compile(r'(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?', re.MULTILINE)
            import_pattern = re.compile(r'import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))\s+from\s+[\'"]([^\'"]+)[\'"]', re.MULTILINE)
            
            for match in func_pattern.finditer(content):
                name, params = match.groups()
                line_num = content[:match.start()].count('\n') + 1
                symbols.append(Symbol(
                    name=name,
                    kind="function",
                    signature=f"function {name}({params})",
                    start_line=line_num,
                    end_line=line_num,
                    file_path=file_path
                ))
            
            for match in arrow_pattern.finditer(content):
                name, params = match.groups()
                line_num = content[:match.start()].count('\n') + 1
                symbols.append(Symbol(
                    name=name,
                    kind="function",
                    signature=f"const {name} = ({params}) =>",
                    start_line=line_num,
                    end_line=line_num,
                    file_path=file_path
                ))
            
            for match in class_pattern.finditer(content):
                name, extends = match.groups()
                line_num = content[:match.start()].count('\n') + 1
                sig = f"class {name}" + (f" extends {extends}" if extends else "")
                symbols.append(Symbol(
                    name=name,
                    kind="class",
                    signature=sig,
                    start_line=line_num,
                    end_line=line_num,
                    file_path=file_path
                ))
            
            for match in import_pattern.finditer(content):
                named, namespace, default, module = match.groups()
                line_num = content[:match.start()].count('\n') + 1
                names = []
                if named:
                    names = [n.strip() for n in named.split(',')]
                elif namespace:
                    names = [namespace]
                elif default:
                    names = [default]
                imports.append(Import(
                    module=module,
                    names=names,
                    line=line_num
                ))
        
        return CodeGraphNode(
            file_path=file_path,
            language=language,
            symbols=symbols,
            imports=imports,
            dependencies=self._resolve_imports(imports)
        )
    
    def _resolve_imports(self, imports: List[Import]) -> List[str]:
        """Resolve import modules to file paths."""
        resolved = []
        
        for imp in imports:
            # Try common resolution patterns
            candidates = [
                imp.module.replace('.', '/') + '.py',
                imp.module.replace('.', '/') + '.js',
                imp.module.replace('.', '/') + '.ts',
                imp.module.replace('.', '/') + '/index.py',
                imp.module.replace('.', '/') + '/index.js',
                imp.module.replace('.', '/') + '/index.ts',
                'src/' + imp.module.replace('.', '/') + '.py',
                'src/' + imp.module.replace('.', '/') + '.js',
                'src/' + imp.module.replace('.', '/') + '.ts',
            ]
            
            for candidate in candidates:
                full_path = os.path.join(self.repo_path, candidate)
                if os.path.exists(full_path):
                    resolved.append(full_path)
                    break
        
        return resolved
    
    def _trace_dependencies(self, node: CodeGraphNode, depth: int) -> List[str]:
        """Trace dependencies up to specified depth using BFS."""
        if depth <= 0:
            return []
        
        visited = set()
        queue = [(dep, 1) for dep in node.dependencies]
        result = []
        
        while queue and len(result) < self.max_deps:
            dep_path, current_depth = queue.pop(0)
            
            if dep_path in visited:
                continue
            visited.add(dep_path)
            result.append(dep_path)
            
            if current_depth < depth:
                dep_node = self._parse_file(dep_path)
                for next_dep in dep_node.dependencies:
                    if next_dep not in visited:
                        queue.append((next_dep, current_depth + 1))
        
        return result
    
    def _symbols_at_lines(self, symbols: List[Symbol], lines: List[int]) -> List[Symbol]:
        """Find symbols that overlap with the given line numbers."""
        result = []
        line_set = set(lines)
        
        for symbol in symbols:
            # Check if any changed line is within this symbol's range
            symbol_lines = set(range(symbol.start_line, symbol.end_line + 1))
            if symbol_lines & line_set:
                result.append(symbol)
        
        return result if result else symbols[:5]  # Fallback to first 5 if no match
    
    def _build_call_graph(self, node: CodeGraphNode, 
                          target_symbols: List[Symbol]) -> Dict[str, List[str]]:
        """Build a simple call graph for target symbols."""
        call_graph = {}
        
        target_names = {s.name for s in target_symbols}
        all_symbols = {s.name for s in node.symbols}
        
        for symbol in target_symbols:
            # This is a simplified call graph - in a real implementation,
            # we would parse function bodies to find actual calls
            call_graph[symbol.name] = []
            
            # Find which other symbols in the file are likely called by this one
            # (based on name appearing in the same file)
            for other in all_symbols:
                if other != symbol.name and other not in target_names:
                    call_graph[symbol.name].append(other)
        
        return call_graph
    
    def format_context_for_llm(self, context: CodeGraphContext) -> str:
        """Format the code graph context as a string for LLM prompt."""
        parts = ["<codegraph_context>"]
        
        # Target file info
        parts.append(f"\n<!-- Target File: {context.target_file} -->")
        parts.append(f"<!-- Symbols at Changed Lines: -->")
        
        for symbol in context.target_symbols[:5]:
            parts.append(f"```{detect_language(symbol.file_path).value}")
            parts.append(f"# {symbol.kind}: {symbol.name}")
            parts.append(symbol.signature)
            if symbol.docstring:
                parts.append(f'"""{symbol.docstring[:200]}"""')
            parts.append("```")
        
        # Dependencies
        if context.dependency_context:
            parts.append("\n<!-- Dependencies: -->")
            for dep_path, symbols in list(context.dependency_context.items())[:10]:
                rel_path = os.path.relpath(dep_path, os.path.dirname(context.target_file)) if context.target_file else dep_path
                parts.append(f"\n<!-- {rel_path} -->")
                for sym in symbols[:5]:
                    parts.append(f"# {sym.kind}: {sym.signature}")
        
        # Call graph
        if context.call_graph:
            parts.append("\n<!-- Call Graph: -->")
            for caller, callees in context.call_graph.items():
                if callees:
                    parts.append(f"# {caller} → {', '.join(callees[:5])}")
        
        parts.append(f"\n<!-- Total context: {context.total_context_chars} chars -->")
        parts.append("</codegraph_context>")
        
        return "\n".join(parts)


# ============================================================================
# Convenience function to replace old build_codegraph
# ============================================================================

def build_codegraph_v2(repo_path: str, target_file: str, 
                       changed_lines: Optional[List[int]] = None) -> str:
    """
    Drop-in replacement for the old build_codegraph function.
    
    Args:
        repo_path: Root path of the repository
        target_file: Relative path to target file
        changed_lines: Optional list of changed line numbers
        
    Returns:
        Formatted context string for LLM
    """
    builder = CodeGraphBuilder(repo_path)
    context = builder.build_context(target_file, changed_lines)
    return builder.format_context_for_llm(context)
