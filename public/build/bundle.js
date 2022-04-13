
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
var app = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_rest_props(props, keys) {
        const rest = {};
        keys = new Set(keys);
        for (const k in props)
            if (!keys.has(k) && k[0] !== '$')
                rest[k] = props[k];
        return rest;
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
        let children = target.childNodes;
        // If target is <head>, there may be children without claim_order
        if (target.nodeName === 'HEAD') {
            const myChildren = [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node.claim_order !== undefined) {
                    myChildren.push(node);
                }
            }
            children = myChildren;
        }
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            // with fast path for when we are on the current longest subsequence
            const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append_hydration(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            // Skip nodes of undefined ordering
            while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
                target.actual_end_child = target.actual_end_child.nextSibling;
            }
            if (node !== target.actual_end_child) {
                // We only insert if the ordering of this node should be modified or the parent node is not target
                if (node.claim_order !== undefined || node.parentNode !== target) {
                    target.insertBefore(node, target.actual_end_child);
                }
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target || node.nextSibling !== null) {
            target.appendChild(node);
        }
    }
    function insert_hydration(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append_hydration(target, node);
        }
        else if (node.parentNode !== target || node.nextSibling != anchor) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function set_attributes(node, attributes) {
        // @ts-ignore
        const descriptors = Object.getOwnPropertyDescriptors(node.__proto__);
        for (const key in attributes) {
            if (attributes[key] == null) {
                node.removeAttribute(key);
            }
            else if (key === 'style') {
                node.style.cssText = attributes[key];
            }
            else if (key === '__value') {
                node.value = node[key] = attributes[key];
            }
            else if (descriptors[key] && descriptors[key].set) {
                node[key] = attributes[key];
            }
            else {
                attr(node, key, attributes[key]);
            }
        }
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function init_claim_info(nodes) {
        if (nodes.claim_info === undefined) {
            nodes.claim_info = { last_index: 0, total_claimed: 0 };
        }
    }
    function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
        // Try to find nodes in an order such that we lengthen the longest increasing subsequence
        init_claim_info(nodes);
        const resultNode = (() => {
            // We first try to find an element after the previous one
            for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    return node;
                }
            }
            // Otherwise, we try to find one before
            // We iterate in reverse so that we don't go too far back
            for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    else if (replacement === undefined) {
                        // Since we spliced before the last_index, we decrease it
                        nodes.claim_info.last_index--;
                    }
                    return node;
                }
            }
            // If we can't find any matching node, we create a new one
            return createNode();
        })();
        resultNode.claim_order = nodes.claim_info.total_claimed;
        nodes.claim_info.total_claimed += 1;
        return resultNode;
    }
    function claim_element_base(nodes, name, attributes, create_element) {
        return claim_node(nodes, (node) => node.nodeName === name, (node) => {
            const remove = [];
            for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name]) {
                    remove.push(attribute.name);
                }
            }
            remove.forEach(v => node.removeAttribute(v));
            return undefined;
        }, () => create_element(name));
    }
    function claim_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, element);
    }
    function claim_text(nodes, data) {
        return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
            const dataStr = '' + data;
            if (node.data.startsWith(dataStr)) {
                if (node.data.length !== dataStr.length) {
                    return node.splitText(dataStr.length);
                }
            }
            else {
                node.data = dataStr;
            }
        }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
        );
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function set_style(node, key, value, important) {
        if (value === null) {
            node.style.removeProperty(key);
        }
        else {
            node.style.setProperty(key, value, important ? 'important' : '');
        }
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
        select.selectedIndex = -1; // no option should be selected
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            while (flushidx < dirty_components.length) {
                const component = dirty_components[flushidx];
                flushidx++;
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function destroy_block(block, lookup) {
        block.d(1);
        lookup.delete(block.key);
    }
    function update_keyed_each(old_blocks, dirty, get_key, dynamic, ctx, list, lookup, node, destroy, create_each_block, next, get_context) {
        let o = old_blocks.length;
        let n = list.length;
        let i = o;
        const old_indexes = {};
        while (i--)
            old_indexes[old_blocks[i].key] = i;
        const new_blocks = [];
        const new_lookup = new Map();
        const deltas = new Map();
        i = n;
        while (i--) {
            const child_ctx = get_context(ctx, list, i);
            const key = get_key(child_ctx);
            let block = lookup.get(key);
            if (!block) {
                block = create_each_block(key, child_ctx);
                block.c();
            }
            else if (dynamic) {
                block.p(child_ctx, dirty);
            }
            new_lookup.set(key, new_blocks[i] = block);
            if (key in old_indexes)
                deltas.set(key, Math.abs(i - old_indexes[key]));
        }
        const will_move = new Set();
        const did_move = new Set();
        function insert(block) {
            transition_in(block, 1);
            block.m(node, next);
            lookup.set(block.key, block);
            next = block.first;
            n--;
        }
        while (o && n) {
            const new_block = new_blocks[n - 1];
            const old_block = old_blocks[o - 1];
            const new_key = new_block.key;
            const old_key = old_block.key;
            if (new_block === old_block) {
                // do nothing
                next = new_block.first;
                o--;
                n--;
            }
            else if (!new_lookup.has(old_key)) {
                // remove old block
                destroy(old_block, lookup);
                o--;
            }
            else if (!lookup.has(new_key) || will_move.has(new_key)) {
                insert(new_block);
            }
            else if (did_move.has(old_key)) {
                o--;
            }
            else if (deltas.get(new_key) > deltas.get(old_key)) {
                did_move.add(new_key);
                insert(new_block);
            }
            else {
                will_move.add(old_key);
                o--;
            }
        }
        while (o--) {
            const old_block = old_blocks[o];
            if (!new_lookup.has(old_block.key))
                destroy(old_block, lookup);
        }
        while (n)
            insert(new_blocks[n - 1]);
        return new_blocks;
    }
    function validate_each_keys(ctx, list, get_context, get_key) {
        const keys = new Set();
        for (let i = 0; i < list.length; i++) {
            const key = get_key(get_context(ctx, list, i));
            if (keys.has(key)) {
                throw new Error('Cannot have duplicate keys in a keyed each');
            }
            keys.add(key);
        }
    }

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }
    function create_component(block) {
        block && block.c();
    }
    function claim_component(block, parent_nodes) {
        block && block.l(parent_nodes);
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.47.0' }, detail), true));
    }
    function append_hydration_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append_hydration(target, node);
    }
    function insert_hydration_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert_hydration(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    const LOCATION = {};
    const ROUTER = {};

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/history.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    function getLocation(source) {
      return {
        ...source.location,
        state: source.history.state,
        key: (source.history.state && source.history.state.key) || "initial"
      };
    }

    function createHistory(source, options) {
      const listeners = [];
      let location = getLocation(source);

      return {
        get location() {
          return location;
        },

        listen(listener) {
          listeners.push(listener);

          const popstateListener = () => {
            location = getLocation(source);
            listener({ location, action: "POP" });
          };

          source.addEventListener("popstate", popstateListener);

          return () => {
            source.removeEventListener("popstate", popstateListener);

            const index = listeners.indexOf(listener);
            listeners.splice(index, 1);
          };
        },

        navigate(to, { state, replace = false } = {}) {
          state = { ...state, key: Date.now() + "" };
          // try...catch iOS Safari limits to 100 pushState calls
          try {
            if (replace) {
              source.history.replaceState(state, null, to);
            } else {
              source.history.pushState(state, null, to);
            }
          } catch (e) {
            source.location[replace ? "replace" : "assign"](to);
          }

          location = getLocation(source);
          listeners.forEach(listener => listener({ location, action: "PUSH" }));
        }
      };
    }

    // Stores history entries in memory for testing or other platforms like Native
    function createMemorySource(initialPathname = "/") {
      let index = 0;
      const stack = [{ pathname: initialPathname, search: "" }];
      const states = [];

      return {
        get location() {
          return stack[index];
        },
        addEventListener(name, fn) {},
        removeEventListener(name, fn) {},
        history: {
          get entries() {
            return stack;
          },
          get index() {
            return index;
          },
          get state() {
            return states[index];
          },
          pushState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            index++;
            stack.push({ pathname, search });
            states.push(state);
          },
          replaceState(state, _, uri) {
            const [pathname, search = ""] = uri.split("?");
            stack[index] = { pathname, search };
            states[index] = state;
          }
        }
      };
    }

    // Global history uses window.history as the source if available,
    // otherwise a memory history
    const canUseDOM = Boolean(
      typeof window !== "undefined" &&
        window.document &&
        window.document.createElement
    );
    const globalHistory = createHistory(canUseDOM ? window : createMemorySource());
    const { navigate } = globalHistory;

    /**
     * Adapted from https://github.com/reach/router/blob/b60e6dd781d5d3a4bdaaf4de665649c0f6a7e78d/src/lib/utils.js
     *
     * https://github.com/reach/router/blob/master/LICENSE
     * */

    const paramRe = /^:(.+)/;

    const SEGMENT_POINTS = 4;
    const STATIC_POINTS = 3;
    const DYNAMIC_POINTS = 2;
    const SPLAT_PENALTY = 1;
    const ROOT_POINTS = 1;

    /**
     * Check if `string` starts with `search`
     * @param {string} string
     * @param {string} search
     * @return {boolean}
     */
    function startsWith(string, search) {
      return string.substr(0, search.length) === search;
    }

    /**
     * Check if `segment` is a root segment
     * @param {string} segment
     * @return {boolean}
     */
    function isRootSegment(segment) {
      return segment === "";
    }

    /**
     * Check if `segment` is a dynamic segment
     * @param {string} segment
     * @return {boolean}
     */
    function isDynamic(segment) {
      return paramRe.test(segment);
    }

    /**
     * Check if `segment` is a splat
     * @param {string} segment
     * @return {boolean}
     */
    function isSplat(segment) {
      return segment[0] === "*";
    }

    /**
     * Split up the URI into segments delimited by `/`
     * @param {string} uri
     * @return {string[]}
     */
    function segmentize(uri) {
      return (
        uri
          // Strip starting/ending `/`
          .replace(/(^\/+|\/+$)/g, "")
          .split("/")
      );
    }

    /**
     * Strip `str` of potential start and end `/`
     * @param {string} str
     * @return {string}
     */
    function stripSlashes(str) {
      return str.replace(/(^\/+|\/+$)/g, "");
    }

    /**
     * Score a route depending on how its individual segments look
     * @param {object} route
     * @param {number} index
     * @return {object}
     */
    function rankRoute(route, index) {
      const score = route.default
        ? 0
        : segmentize(route.path).reduce((score, segment) => {
            score += SEGMENT_POINTS;

            if (isRootSegment(segment)) {
              score += ROOT_POINTS;
            } else if (isDynamic(segment)) {
              score += DYNAMIC_POINTS;
            } else if (isSplat(segment)) {
              score -= SEGMENT_POINTS + SPLAT_PENALTY;
            } else {
              score += STATIC_POINTS;
            }

            return score;
          }, 0);

      return { route, score, index };
    }

    /**
     * Give a score to all routes and sort them on that
     * @param {object[]} routes
     * @return {object[]}
     */
    function rankRoutes(routes) {
      return (
        routes
          .map(rankRoute)
          // If two routes have the exact same score, we go by index instead
          .sort((a, b) =>
            a.score < b.score ? 1 : a.score > b.score ? -1 : a.index - b.index
          )
      );
    }

    /**
     * Ranks and picks the best route to match. Each segment gets the highest
     * amount of points, then the type of segment gets an additional amount of
     * points where
     *
     *  static > dynamic > splat > root
     *
     * This way we don't have to worry about the order of our routes, let the
     * computers do it.
     *
     * A route looks like this
     *
     *  { path, default, value }
     *
     * And a returned match looks like:
     *
     *  { route, params, uri }
     *
     * @param {object[]} routes
     * @param {string} uri
     * @return {?object}
     */
    function pick(routes, uri) {
      let match;
      let default_;

      const [uriPathname] = uri.split("?");
      const uriSegments = segmentize(uriPathname);
      const isRootUri = uriSegments[0] === "";
      const ranked = rankRoutes(routes);

      for (let i = 0, l = ranked.length; i < l; i++) {
        const route = ranked[i].route;
        let missed = false;

        if (route.default) {
          default_ = {
            route,
            params: {},
            uri
          };
          continue;
        }

        const routeSegments = segmentize(route.path);
        const params = {};
        const max = Math.max(uriSegments.length, routeSegments.length);
        let index = 0;

        for (; index < max; index++) {
          const routeSegment = routeSegments[index];
          const uriSegment = uriSegments[index];

          if (routeSegment !== undefined && isSplat(routeSegment)) {
            // Hit a splat, just grab the rest, and return a match
            // uri:   /files/documents/work
            // route: /files/* or /files/*splatname
            const splatName = routeSegment === "*" ? "*" : routeSegment.slice(1);

            params[splatName] = uriSegments
              .slice(index)
              .map(decodeURIComponent)
              .join("/");
            break;
          }

          if (uriSegment === undefined) {
            // URI is shorter than the route, no match
            // uri:   /users
            // route: /users/:userId
            missed = true;
            break;
          }

          let dynamicMatch = paramRe.exec(routeSegment);

          if (dynamicMatch && !isRootUri) {
            const value = decodeURIComponent(uriSegment);
            params[dynamicMatch[1]] = value;
          } else if (routeSegment !== uriSegment) {
            // Current segments don't match, not dynamic, not splat, so no match
            // uri:   /users/123/settings
            // route: /users/:id/profile
            missed = true;
            break;
          }
        }

        if (!missed) {
          match = {
            route,
            params,
            uri: "/" + uriSegments.slice(0, index).join("/")
          };
          break;
        }
      }

      return match || default_ || null;
    }

    /**
     * Check if the `path` matches the `uri`.
     * @param {string} path
     * @param {string} uri
     * @return {?object}
     */
    function match(route, uri) {
      return pick([route], uri);
    }

    /**
     * Add the query to the pathname if a query is given
     * @param {string} pathname
     * @param {string} [query]
     * @return {string}
     */
    function addQuery(pathname, query) {
      return pathname + (query ? `?${query}` : "");
    }

    /**
     * Resolve URIs as though every path is a directory, no files. Relative URIs
     * in the browser can feel awkward because not only can you be "in a directory",
     * you can be "at a file", too. For example:
     *
     *  browserSpecResolve('foo', '/bar/') => /bar/foo
     *  browserSpecResolve('foo', '/bar') => /foo
     *
     * But on the command line of a file system, it's not as complicated. You can't
     * `cd` from a file, only directories. This way, links have to know less about
     * their current path. To go deeper you can do this:
     *
     *  <Link to="deeper"/>
     *  // instead of
     *  <Link to=`{${props.uri}/deeper}`/>
     *
     * Just like `cd`, if you want to go deeper from the command line, you do this:
     *
     *  cd deeper
     *  # not
     *  cd $(pwd)/deeper
     *
     * By treating every path as a directory, linking to relative paths should
     * require less contextual information and (fingers crossed) be more intuitive.
     * @param {string} to
     * @param {string} base
     * @return {string}
     */
    function resolve(to, base) {
      // /foo/bar, /baz/qux => /foo/bar
      if (startsWith(to, "/")) {
        return to;
      }

      const [toPathname, toQuery] = to.split("?");
      const [basePathname] = base.split("?");
      const toSegments = segmentize(toPathname);
      const baseSegments = segmentize(basePathname);

      // ?a=b, /users?b=c => /users?a=b
      if (toSegments[0] === "") {
        return addQuery(basePathname, toQuery);
      }

      // profile, /users/789 => /users/789/profile
      if (!startsWith(toSegments[0], ".")) {
        const pathname = baseSegments.concat(toSegments).join("/");

        return addQuery((basePathname === "/" ? "" : "/") + pathname, toQuery);
      }

      // ./       , /users/123 => /users/123
      // ../      , /users/123 => /users
      // ../..    , /users/123 => /
      // ../../one, /a/b/c/d   => /a/b/one
      // .././one , /a/b/c/d   => /a/b/c/one
      const allSegments = baseSegments.concat(toSegments);
      const segments = [];

      allSegments.forEach(segment => {
        if (segment === "..") {
          segments.pop();
        } else if (segment !== ".") {
          segments.push(segment);
        }
      });

      return addQuery("/" + segments.join("/"), toQuery);
    }

    /**
     * Combines the `basepath` and the `path` into one path.
     * @param {string} basepath
     * @param {string} path
     */
    function combinePaths(basepath, path) {
      return `${stripSlashes(
    path === "/" ? basepath : `${stripSlashes(basepath)}/${stripSlashes(path)}`
  )}/`;
    }

    /**
     * Decides whether a given `event` should result in a navigation or not.
     * @param {object} event
     */
    function shouldNavigate(event) {
      return (
        !event.defaultPrevented &&
        event.button === 0 &&
        !(event.metaKey || event.altKey || event.ctrlKey || event.shiftKey)
      );
    }

    function hostMatches(anchor) {
      const host = location.host;
      return (
        anchor.host == host ||
        // svelte seems to kill anchor.host value in ie11, so fall back to checking href
        anchor.href.indexOf(`https://${host}`) === 0 ||
        anchor.href.indexOf(`http://${host}`) === 0
      )
    }

    /* node_modules\svelte-routing\src\Router.svelte generated by Svelte v3.47.0 */

    function create_fragment$n(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[8],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$n.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$n($$self, $$props, $$invalidate) {
    	let $location;
    	let $routes;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Router', slots, ['default']);
    	let { basepath = "/" } = $$props;
    	let { url = null } = $$props;
    	const locationContext = getContext(LOCATION);
    	const routerContext = getContext(ROUTER);
    	const routes = writable([]);
    	validate_store(routes, 'routes');
    	component_subscribe($$self, routes, value => $$invalidate(6, $routes = value));
    	const activeRoute = writable(null);
    	let hasActiveRoute = false; // Used in SSR to synchronously set that a Route is active.

    	// If locationContext is not set, this is the topmost Router in the tree.
    	// If the `url` prop is given we force the location to it.
    	const location = locationContext || writable(url ? { pathname: url } : globalHistory.location);

    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(5, $location = value));

    	// If routerContext is set, the routerBase of the parent Router
    	// will be the base for this Router's descendants.
    	// If routerContext is not set, the path and resolved uri will both
    	// have the value of the basepath prop.
    	const base = routerContext
    	? routerContext.routerBase
    	: writable({ path: basepath, uri: basepath });

    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(7, $base = value));

    	const routerBase = derived([base, activeRoute], ([base, activeRoute]) => {
    		// If there is no activeRoute, the routerBase will be identical to the base.
    		if (activeRoute === null) {
    			return base;
    		}

    		const { path: basepath } = base;
    		const { route, uri } = activeRoute;

    		// Remove the potential /* or /*splatname from
    		// the end of the child Routes relative paths.
    		const path = route.default
    		? basepath
    		: route.path.replace(/\*.*$/, "");

    		return { path, uri };
    	});

    	function registerRoute(route) {
    		const { path: basepath } = $base;
    		let { path } = route;

    		// We store the original path in the _path property so we can reuse
    		// it when the basepath changes. The only thing that matters is that
    		// the route reference is intact, so mutation is fine.
    		route._path = path;

    		route.path = combinePaths(basepath, path);

    		if (typeof window === "undefined") {
    			// In SSR we should set the activeRoute immediately if it is a match.
    			// If there are more Routes being registered after a match is found,
    			// we just skip them.
    			if (hasActiveRoute) {
    				return;
    			}

    			const matchingRoute = match(route, $location.pathname);

    			if (matchingRoute) {
    				activeRoute.set(matchingRoute);
    				hasActiveRoute = true;
    			}
    		} else {
    			routes.update(rs => {
    				rs.push(route);
    				return rs;
    			});
    		}
    	}

    	function unregisterRoute(route) {
    		routes.update(rs => {
    			const index = rs.indexOf(route);
    			rs.splice(index, 1);
    			return rs;
    		});
    	}

    	if (!locationContext) {
    		// The topmost Router in the tree is responsible for updating
    		// the location store and supplying it through context.
    		onMount(() => {
    			const unlisten = globalHistory.listen(history => {
    				location.set(history.location);
    			});

    			return unlisten;
    		});

    		setContext(LOCATION, location);
    	}

    	setContext(ROUTER, {
    		activeRoute,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute
    	});

    	const writable_props = ['basepath', 'url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Router> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		setContext,
    		onMount,
    		writable,
    		derived,
    		LOCATION,
    		ROUTER,
    		globalHistory,
    		pick,
    		match,
    		stripSlashes,
    		combinePaths,
    		basepath,
    		url,
    		locationContext,
    		routerContext,
    		routes,
    		activeRoute,
    		hasActiveRoute,
    		location,
    		base,
    		routerBase,
    		registerRoute,
    		unregisterRoute,
    		$location,
    		$routes,
    		$base
    	});

    	$$self.$inject_state = $$props => {
    		if ('basepath' in $$props) $$invalidate(3, basepath = $$props.basepath);
    		if ('url' in $$props) $$invalidate(4, url = $$props.url);
    		if ('hasActiveRoute' in $$props) hasActiveRoute = $$props.hasActiveRoute;
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$base*/ 128) {
    			// This reactive statement will update all the Routes' path when
    			// the basepath changes.
    			{
    				const { path: basepath } = $base;

    				routes.update(rs => {
    					rs.forEach(r => r.path = combinePaths(basepath, r._path));
    					return rs;
    				});
    			}
    		}

    		if ($$self.$$.dirty & /*$routes, $location*/ 96) {
    			// This reactive statement will be run when the Router is created
    			// when there are no Routes and then again the following tick, so it
    			// will not find an active Route in SSR and in the browser it will only
    			// pick an active Route after all Routes have been registered.
    			{
    				const bestMatch = pick($routes, $location.pathname);
    				activeRoute.set(bestMatch);
    			}
    		}
    	};

    	return [
    		routes,
    		location,
    		base,
    		basepath,
    		url,
    		$location,
    		$routes,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Router extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$n, create_fragment$n, safe_not_equal, { basepath: 3, url: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Router",
    			options,
    			id: create_fragment$n.name
    		});
    	}

    	get basepath() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set basepath(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get url() {
    		throw new Error("<Router>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<Router>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-routing\src\Route.svelte generated by Svelte v3.47.0 */

    const get_default_slot_changes$1 = dirty => ({
    	params: dirty & /*routeParams*/ 4,
    	location: dirty & /*$location*/ 16
    });

    const get_default_slot_context$1 = ctx => ({
    	params: /*routeParams*/ ctx[2],
    	location: /*$location*/ ctx[4]
    });

    // (40:0) {#if $activeRoute !== null && $activeRoute.route === route}
    function create_if_block$c(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$1, create_else_block$a];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*component*/ ctx[0] !== null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$c.name,
    		type: "if",
    		source: "(40:0) {#if $activeRoute !== null && $activeRoute.route === route}",
    		ctx
    	});

    	return block;
    }

    // (43:2) {:else}
    function create_else_block$a(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[10].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[9], get_default_slot_context$1);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, routeParams, $location*/ 532)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[9],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[9])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[9], dirty, get_default_slot_changes$1),
    						get_default_slot_context$1
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$a.name,
    		type: "else",
    		source: "(43:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (41:2) {#if component !== null}
    function create_if_block_1$1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;

    	const switch_instance_spread_levels = [
    		{ location: /*$location*/ ctx[4] },
    		/*routeParams*/ ctx[2],
    		/*routeProps*/ ctx[3]
    	];

    	var switch_value = /*component*/ ctx[0];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty & /*$location, routeParams, routeProps*/ 28)
    			? get_spread_update(switch_instance_spread_levels, [
    					dirty & /*$location*/ 16 && { location: /*$location*/ ctx[4] },
    					dirty & /*routeParams*/ 4 && get_spread_object(/*routeParams*/ ctx[2]),
    					dirty & /*routeProps*/ 8 && get_spread_object(/*routeProps*/ ctx[3])
    				])
    			: {};

    			if (switch_value !== (switch_value = /*component*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(41:2) {#if component !== null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$m(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7] && create_if_block$c(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*$activeRoute*/ ctx[1] !== null && /*$activeRoute*/ ctx[1].route === /*route*/ ctx[7]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*$activeRoute*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$c(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$m.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$m($$self, $$props, $$invalidate) {
    	let $activeRoute;
    	let $location;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Route', slots, ['default']);
    	let { path = "" } = $$props;
    	let { component = null } = $$props;
    	const { registerRoute, unregisterRoute, activeRoute } = getContext(ROUTER);
    	validate_store(activeRoute, 'activeRoute');
    	component_subscribe($$self, activeRoute, value => $$invalidate(1, $activeRoute = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(4, $location = value));

    	const route = {
    		path,
    		// If no path prop is given, this Route will act as the default Route
    		// that is rendered if no other Route in the Router is a match.
    		default: path === ""
    	};

    	let routeParams = {};
    	let routeProps = {};
    	registerRoute(route);

    	// There is no need to unregister Routes in SSR since it will all be
    	// thrown away anyway.
    	if (typeof window !== "undefined") {
    		onDestroy(() => {
    			unregisterRoute(route);
    		});
    	}

    	$$self.$$set = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ('path' in $$new_props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$new_props) $$invalidate(0, component = $$new_props.component);
    		if ('$$scope' in $$new_props) $$invalidate(9, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		onDestroy,
    		ROUTER,
    		LOCATION,
    		path,
    		component,
    		registerRoute,
    		unregisterRoute,
    		activeRoute,
    		location,
    		route,
    		routeParams,
    		routeProps,
    		$activeRoute,
    		$location
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(13, $$props = assign(assign({}, $$props), $$new_props));
    		if ('path' in $$props) $$invalidate(8, path = $$new_props.path);
    		if ('component' in $$props) $$invalidate(0, component = $$new_props.component);
    		if ('routeParams' in $$props) $$invalidate(2, routeParams = $$new_props.routeParams);
    		if ('routeProps' in $$props) $$invalidate(3, routeProps = $$new_props.routeProps);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$activeRoute*/ 2) {
    			if ($activeRoute && $activeRoute.route === route) {
    				$$invalidate(2, routeParams = $activeRoute.params);
    			}
    		}

    		{
    			const { path, component, ...rest } = $$props;
    			$$invalidate(3, routeProps = rest);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		component,
    		$activeRoute,
    		routeParams,
    		routeProps,
    		$location,
    		activeRoute,
    		location,
    		route,
    		path,
    		$$scope,
    		slots
    	];
    }

    class Route extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$m, create_fragment$m, safe_not_equal, { path: 8, component: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Route",
    			options,
    			id: create_fragment$m.name
    		});
    	}

    	get path() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set path(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get component() {
    		throw new Error("<Route>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set component(value) {
    		throw new Error("<Route>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\svelte-routing\src\Link.svelte generated by Svelte v3.47.0 */
    const file$l = "node_modules\\svelte-routing\\src\\Link.svelte";

    function create_fragment$l(ctx) {
    	let a;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[16].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[15], null);

    	let a_levels = [
    		{ href: /*href*/ ctx[0] },
    		{ "aria-current": /*ariaCurrent*/ ctx[2] },
    		/*props*/ ctx[1],
    		/*$$restProps*/ ctx[6]
    	];

    	let a_data = {};

    	for (let i = 0; i < a_levels.length; i += 1) {
    		a_data = assign(a_data, a_levels[i]);
    	}

    	const block = {
    		c: function create() {
    			a = element("a");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, "aria-current": true });
    			var a_nodes = children(a);
    			if (default_slot) default_slot.l(a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_attributes(a, a_data);
    			add_location(a, file$l, 40, 0, 1249);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);

    			if (default_slot) {
    				default_slot.m(a, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*onClick*/ ctx[5], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 32768)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[15],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[15])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[15], dirty, null),
    						null
    					);
    				}
    			}

    			set_attributes(a, a_data = get_spread_update(a_levels, [
    				(!current || dirty & /*href*/ 1) && { href: /*href*/ ctx[0] },
    				(!current || dirty & /*ariaCurrent*/ 4) && { "aria-current": /*ariaCurrent*/ ctx[2] },
    				dirty & /*props*/ 2 && /*props*/ ctx[1],
    				dirty & /*$$restProps*/ 64 && /*$$restProps*/ ctx[6]
    			]));
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$l($$self, $$props, $$invalidate) {
    	let ariaCurrent;
    	const omit_props_names = ["to","replace","state","getProps"];
    	let $$restProps = compute_rest_props($$props, omit_props_names);
    	let $location;
    	let $base;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Link', slots, ['default']);
    	let { to = "#" } = $$props;
    	let { replace = false } = $$props;
    	let { state = {} } = $$props;
    	let { getProps = () => ({}) } = $$props;
    	const { base } = getContext(ROUTER);
    	validate_store(base, 'base');
    	component_subscribe($$self, base, value => $$invalidate(14, $base = value));
    	const location = getContext(LOCATION);
    	validate_store(location, 'location');
    	component_subscribe($$self, location, value => $$invalidate(13, $location = value));
    	const dispatch = createEventDispatcher();
    	let href, isPartiallyCurrent, isCurrent, props;

    	function onClick(event) {
    		dispatch("click", event);

    		if (shouldNavigate(event)) {
    			event.preventDefault();

    			// Don't push another entry to the history stack when the user
    			// clicks on a Link to the page they are currently on.
    			const shouldReplace = $location.pathname === href || replace;

    			navigate(href, { state, replace: shouldReplace });
    		}
    	}

    	$$self.$$set = $$new_props => {
    		$$props = assign(assign({}, $$props), exclude_internal_props($$new_props));
    		$$invalidate(6, $$restProps = compute_rest_props($$props, omit_props_names));
    		if ('to' in $$new_props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$new_props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$new_props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$new_props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('$$scope' in $$new_props) $$invalidate(15, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		createEventDispatcher,
    		ROUTER,
    		LOCATION,
    		navigate,
    		startsWith,
    		resolve,
    		shouldNavigate,
    		to,
    		replace,
    		state,
    		getProps,
    		base,
    		location,
    		dispatch,
    		href,
    		isPartiallyCurrent,
    		isCurrent,
    		props,
    		onClick,
    		ariaCurrent,
    		$location,
    		$base
    	});

    	$$self.$inject_state = $$new_props => {
    		if ('to' in $$props) $$invalidate(7, to = $$new_props.to);
    		if ('replace' in $$props) $$invalidate(8, replace = $$new_props.replace);
    		if ('state' in $$props) $$invalidate(9, state = $$new_props.state);
    		if ('getProps' in $$props) $$invalidate(10, getProps = $$new_props.getProps);
    		if ('href' in $$props) $$invalidate(0, href = $$new_props.href);
    		if ('isPartiallyCurrent' in $$props) $$invalidate(11, isPartiallyCurrent = $$new_props.isPartiallyCurrent);
    		if ('isCurrent' in $$props) $$invalidate(12, isCurrent = $$new_props.isCurrent);
    		if ('props' in $$props) $$invalidate(1, props = $$new_props.props);
    		if ('ariaCurrent' in $$props) $$invalidate(2, ariaCurrent = $$new_props.ariaCurrent);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*to, $base*/ 16512) {
    			$$invalidate(0, href = to === "/" ? $base.uri : resolve(to, $base.uri));
    		}

    		if ($$self.$$.dirty & /*$location, href*/ 8193) {
    			$$invalidate(11, isPartiallyCurrent = startsWith($location.pathname, href));
    		}

    		if ($$self.$$.dirty & /*href, $location*/ 8193) {
    			$$invalidate(12, isCurrent = href === $location.pathname);
    		}

    		if ($$self.$$.dirty & /*isCurrent*/ 4096) {
    			$$invalidate(2, ariaCurrent = isCurrent ? "page" : undefined);
    		}

    		if ($$self.$$.dirty & /*getProps, $location, href, isPartiallyCurrent, isCurrent*/ 15361) {
    			$$invalidate(1, props = getProps({
    				location: $location,
    				href,
    				isPartiallyCurrent,
    				isCurrent
    			}));
    		}
    	};

    	return [
    		href,
    		props,
    		ariaCurrent,
    		base,
    		location,
    		onClick,
    		$$restProps,
    		to,
    		replace,
    		state,
    		getProps,
    		isPartiallyCurrent,
    		isCurrent,
    		$location,
    		$base,
    		$$scope,
    		slots
    	];
    }

    class Link extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$l, create_fragment$l, safe_not_equal, {
    			to: 7,
    			replace: 8,
    			state: 9,
    			getProps: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Link",
    			options,
    			id: create_fragment$l.name
    		});
    	}

    	get to() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set to(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get replace() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set replace(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get state() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set state(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get getProps() {
    		throw new Error("<Link>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set getProps(value) {
    		throw new Error("<Link>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /**
     * A link action that can be added to <a href=""> tags rather
     * than using the <Link> component.
     *
     * Example:
     * ```html
     * <a href="/post/{postId}" use:link>{post.title}</a>
     * ```
     */
    function link(node) {
      function onClick(event) {
        const anchor = event.currentTarget;

        if (
          anchor.target === "" &&
          hostMatches(anchor) &&
          shouldNavigate(event)
        ) {
          event.preventDefault();
          navigate(anchor.pathname + anchor.search, { replace: anchor.hasAttribute("replace") });
        }
      }

      node.addEventListener("click", onClick);

      return {
        destroy() {
          node.removeEventListener("click", onClick);
        }
      };
    }

    /* src\components\HomeNav.svelte generated by Svelte v3.47.0 */

    const { Object: Object_1$4, console: console_1$9 } = globals;
    const file$k = "src\\components\\HomeNav.svelte";

    function create_fragment$k(ctx) {
    	let nav;
    	let div;
    	let a0;
    	let img;
    	let img_src_value;
    	let t0;

    	let t1_value = (/*user*/ ctx[0]
    	? /*user*/ ctx[0].instagram
    	: "Vitrine da Casa") + "";

    	let t1;
    	let t2;
    	let a1;
    	let t3;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			div = element("div");
    			a0 = element("a");
    			img = element("img");
    			t0 = space();
    			t1 = text(t1_value);
    			t2 = space();
    			a1 = element("a");
    			t3 = text("Registrar");
    			this.h();
    		},
    		l: function claim(nodes) {
    			nav = claim_element(nodes, "NAV", { class: true, style: true });
    			var nav_nodes = children(nav);
    			div = claim_element(nav_nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			a0 = claim_element(div_nodes, "A", { class: true, href: true });
    			var a0_nodes = children(a0);
    			img = claim_element(a0_nodes, "IMG", { src: true, alt: true, height: true });
    			t0 = claim_space(a0_nodes);
    			t1 = claim_text(a0_nodes, t1_value);
    			a0_nodes.forEach(detach_dev);
    			t2 = claim_space(div_nodes);
    			a1 = claim_element(div_nodes, "A", { href: true, target: true, class: true });
    			var a1_nodes = children(a1);
    			t3 = claim_text(a1_nodes, "Registrar");
    			a1_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			nav_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = "/img/link.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "vitrinedacasa");
    			attr_dev(img, "height", "34px");
    			add_location(img, file$k, 21, 6, 584);
    			attr_dev(a0, "class", "navbar-brand landing-brand");
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$k, 20, 4, 529);
    			attr_dev(a1, "href", "/register");
    			attr_dev(a1, "target", "_blank");
    			attr_dev(a1, "class", "btn btn-lg btn-success my-2 my-sm-0 ml-3");
    			add_location(a1, file$k, 44, 4, 1366);
    			attr_dev(div, "class", "container");
    			add_location(div, file$k, 19, 2, 500);
    			attr_dev(nav, "class", "navbar navbar-expand-md navbar-light landing-navbar svelte-1eoy7ne");
    			attr_dev(nav, "style", /*cssVarStyles*/ ctx[1]);
    			add_location(nav, file$k, 18, 0, 408);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			append_hydration_dev(nav, div);
    			append_hydration_dev(div, a0);
    			append_hydration_dev(a0, img);
    			append_hydration_dev(a0, t0);
    			append_hydration_dev(a0, t1);
    			append_hydration_dev(div, t2);
    			append_hydration_dev(div, a1);
    			append_hydration_dev(a1, t3);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*user*/ 1 && t1_value !== (t1_value = (/*user*/ ctx[0]
    			? /*user*/ ctx[0].instagram
    			: "Vitrine da Casa") + "")) set_data_dev(t1, t1_value);

    			if (dirty & /*cssVarStyles*/ 2) {
    				attr_dev(nav, "style", /*cssVarStyles*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$k($$self, $$props, $$invalidate) {
    	let cssVarStyles;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('HomeNav', slots, []);
    	let { user } = $$props;
    	let styles = {};

    	onMount(async () => {
    		console.log('user: ', user);
    		$$invalidate(2, styles = user.style);
    	});

    	const writable_props = ['user'];

    	Object_1$4.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$9.warn(`<HomeNav> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('user' in $$props) $$invalidate(0, user = $$props.user);
    	};

    	$$self.$capture_state = () => ({ onMount, user, styles, cssVarStyles });

    	$$self.$inject_state = $$props => {
    		if ('user' in $$props) $$invalidate(0, user = $$props.user);
    		if ('styles' in $$props) $$invalidate(2, styles = $$props.styles);
    		if ('cssVarStyles' in $$props) $$invalidate(1, cssVarStyles = $$props.cssVarStyles);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*styles*/ 4) {
    			$$invalidate(1, cssVarStyles = Object.entries(styles).map(([key, value]) => `--${key}:${value}`).join(';'));
    		}
    	};

    	return [user, cssVarStyles, styles];
    }

    class HomeNav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$k, create_fragment$k, safe_not_equal, { user: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "HomeNav",
    			options,
    			id: create_fragment$k.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*user*/ ctx[0] === undefined && !('user' in props)) {
    			console_1$9.warn("<HomeNav> was created without expected prop 'user'");
    		}
    	}

    	get user() {
    		throw new Error("<HomeNav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set user(value) {
    		throw new Error("<HomeNav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Footer.svelte generated by Svelte v3.47.0 */

    const file$j = "src\\components\\Footer.svelte";

    function create_fragment$j(ctx) {
    	let footer;
    	let div3;
    	let div2;
    	let div0;
    	let ul;
    	let li0;
    	let a0;
    	let t0;
    	let t1;
    	let li1;
    	let a1;
    	let t2;
    	let t3;
    	let div1;
    	let p;
    	let t4;
    	let a2;
    	let t5;

    	const block = {
    		c: function create() {
    			footer = element("footer");
    			div3 = element("div");
    			div2 = element("div");
    			div0 = element("div");
    			ul = element("ul");
    			li0 = element("li");
    			a0 = element("a");
    			t0 = text("Github");
    			t1 = space();
    			li1 = element("li");
    			a1 = element("a");
    			t2 = text("Termos");
    			t3 = space();
    			div1 = element("div");
    			p = element("p");
    			t4 = text("Feito por ");
    			a2 = element("a");
    			t5 = text("Douglas Monteiro");
    			this.h();
    		},
    		l: function claim(nodes) {
    			footer = claim_element(nodes, "FOOTER", { class: true });
    			var footer_nodes = children(footer);
    			div3 = claim_element(footer_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div0 = claim_element(div2_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			ul = claim_element(div0_nodes, "UL", { class: true });
    			var ul_nodes = children(ul);
    			li0 = claim_element(ul_nodes, "LI", { class: true });
    			var li0_nodes = children(li0);
    			a0 = claim_element(li0_nodes, "A", { class: true, href: true });
    			var a0_nodes = children(a0);
    			t0 = claim_text(a0_nodes, "Github");
    			a0_nodes.forEach(detach_dev);
    			li0_nodes.forEach(detach_dev);
    			t1 = claim_space(ul_nodes);
    			li1 = claim_element(ul_nodes, "LI", { class: true });
    			var li1_nodes = children(li1);
    			a1 = claim_element(li1_nodes, "A", { class: true, href: true });
    			var a1_nodes = children(a1);
    			t2 = claim_text(a1_nodes, "Termos");
    			a1_nodes.forEach(detach_dev);
    			li1_nodes.forEach(detach_dev);
    			ul_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t3 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			p = claim_element(div1_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t4 = claim_text(p_nodes, "Feito por ");
    			a2 = claim_element(p_nodes, "A", { href: true });
    			var a2_nodes = children(a2);
    			t5 = claim_text(a2_nodes, "Douglas Monteiro");
    			a2_nodes.forEach(detach_dev);
    			p_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			footer_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a0, "class", "text-muted");
    			attr_dev(a0, "href", "https://github.com/douglasmonteiro-dev");
    			add_location(a0, file$j, 6, 12, 216);
    			attr_dev(li0, "class", "list-inline-item");
    			add_location(li0, file$j, 5, 10, 173);
    			attr_dev(a1, "class", "text-muted");
    			attr_dev(a1, "href", "/");
    			add_location(a1, file$j, 15, 12, 675);
    			attr_dev(li1, "class", "list-inline-item");
    			add_location(li1, file$j, 14, 10, 632);
    			attr_dev(ul, "class", "list-inline");
    			add_location(ul, file$j, 4, 8, 137);
    			attr_dev(div0, "class", "col-6 text-left");
    			add_location(div0, file$j, 3, 6, 98);
    			attr_dev(a2, "href", "https://new-portfolio.dgsmonteiro.vercel.app/");
    			add_location(a2, file$j, 21, 20, 848);
    			attr_dev(p, "class", "mb-0");
    			add_location(p, file$j, 20, 8, 810);
    			attr_dev(div1, "class", "col-6 text-right");
    			add_location(div1, file$j, 19, 6, 770);
    			attr_dev(div2, "class", "row text-muted");
    			add_location(div2, file$j, 2, 4, 62);
    			attr_dev(div3, "class", "container-fluid");
    			add_location(div3, file$j, 1, 2, 27);
    			attr_dev(footer, "class", "footer");
    			add_location(footer, file$j, 0, 0, 0);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, footer, anchor);
    			append_hydration_dev(footer, div3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div0, ul);
    			append_hydration_dev(ul, li0);
    			append_hydration_dev(li0, a0);
    			append_hydration_dev(a0, t0);
    			append_hydration_dev(ul, t1);
    			append_hydration_dev(ul, li1);
    			append_hydration_dev(li1, a1);
    			append_hydration_dev(a1, t2);
    			append_hydration_dev(div2, t3);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t4);
    			append_hydration_dev(p, a2);
    			append_hydration_dev(a2, t5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$j($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$j, create_fragment$j, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment$j.name
    		});
    	}
    }

    /* src\pages\Home.svelte generated by Svelte v3.47.0 */
    const file$i = "src\\pages\\Home.svelte";

    function create_fragment$i(ctx) {
    	let homenav;
    	let t0;
    	let section;
    	let div5;
    	let div4;
    	let div1;
    	let span;
    	let t1;
    	let t2;
    	let h1;
    	let t3;
    	let t4;
    	let p;
    	let t5;
    	let br0;
    	let t6;
    	let br1;
    	let t7;
    	let t8;
    	let div0;
    	let a0;
    	let t9;
    	let t10;
    	let a1;
    	let t11;
    	let t12;
    	let div3;
    	let div2;
    	let img;
    	let img_src_value;
    	let t13;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;
    	homenav = new HomeNav({ $$inline: true });
    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(homenav.$$.fragment);
    			t0 = space();
    			section = element("section");
    			div5 = element("div");
    			div4 = element("div");
    			div1 = element("div");
    			span = element("span");
    			t1 = text("v1.0.0");
    			t2 = space();
    			h1 = element("h1");
    			t3 = text("Somos inovação em atendimento de comércio e serviços");
    			t4 = space();
    			p = element("p");
    			t5 = text("Ta cansado de procurar um site para o sua empresa ?? Não mais !! ");
    			br0 = element("br");
    			t6 = text("\r\n           Chegou o mais novo sistema de automação online que te disponibiliza uma página online.\r\n           ");
    			br1 = element("br");
    			t7 = text(" Chega de tentar procurar um criador de sites, disponibilize com facilidade seu produto ou serviço para seus clientes.");
    			t8 = space();
    			div0 = element("div");
    			a0 = element("a");
    			t9 = text("Criar");
    			t10 = space();
    			a1 = element("a");
    			t11 = text("Entrar");
    			t12 = space();
    			div3 = element("div");
    			div2 = element("div");
    			img = element("img");
    			t13 = space();
    			create_component(footer.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			claim_component(homenav.$$.fragment, nodes);
    			t0 = claim_space(nodes);
    			section = claim_element(nodes, "SECTION", { class: true });
    			var section_nodes = children(section);
    			div5 = claim_element(section_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div1 = claim_element(div4_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			span = claim_element(div1_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t1 = claim_text(span_nodes, "v1.0.0");
    			span_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			h1 = claim_element(div1_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t3 = claim_text(h1_nodes, "Somos inovação em atendimento de comércio e serviços");
    			h1_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);
    			p = claim_element(div1_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t5 = claim_text(p_nodes, "Ta cansado de procurar um site para o sua empresa ?? Não mais !! ");
    			br0 = claim_element(p_nodes, "BR", {});
    			t6 = claim_text(p_nodes, "\r\n           Chegou o mais novo sistema de automação online que te disponibiliza uma página online.\r\n           ");
    			br1 = claim_element(p_nodes, "BR", {});
    			t7 = claim_text(p_nodes, " Chega de tentar procurar um criador de sites, disponibilize com facilidade seu produto ou serviço para seus clientes.");
    			p_nodes.forEach(detach_dev);
    			t8 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			a0 = claim_element(div0_nodes, "A", { href: true, replace: true, class: true });
    			var a0_nodes = children(a0);
    			t9 = claim_text(a0_nodes, "Criar");
    			a0_nodes.forEach(detach_dev);
    			t10 = claim_space(div0_nodes);
    			a1 = claim_element(div0_nodes, "A", { href: true, replace: true, class: true });
    			var a1_nodes = children(a1);
    			t11 = claim_text(a1_nodes, "Entrar");
    			a1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t12 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			img = claim_element(div2_nodes, "IMG", { src: true, alt: true, class: true });
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			section_nodes.forEach(detach_dev);
    			t13 = claim_space(nodes);
    			claim_component(footer.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "badge badge-soft-primary p-1");
    			add_location(span, file$i, 13, 8, 441);
    			attr_dev(h1, "class", "my-4");
    			add_location(h1, file$i, 15, 8, 509);
    			add_location(br0, file$i, 18, 75, 692);
    			add_location(br1, file$i, 20, 11, 809);
    			attr_dev(p, "class", "text-lg");
    			add_location(p, file$i, 17, 8, 596);
    			attr_dev(a0, "href", "/register");
    			attr_dev(a0, "replace", "");
    			attr_dev(a0, "class", "btn btn-primary btn-lg mr-1");
    			add_location(a0, file$i, 38, 10, 1520);
    			attr_dev(a1, "href", "/login");
    			attr_dev(a1, "replace", "");
    			attr_dev(a1, "class", "btn btn-outline-primary btn-lg mr-1");
    			add_location(a1, file$i, 44, 10, 1678);
    			attr_dev(div0, "class", "my-4");
    			add_location(div0, file$i, 37, 8, 1490);
    			attr_dev(div1, "class", "col-lg-5 mx-auto");
    			add_location(div1, file$i, 12, 6, 401);
    			if (!src_url_equal(img.src, img_src_value = "img/screenshots/mixed.jpg")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Dark/Light Bootstrap Admin Template");
    			attr_dev(img, "class", "img-fluid");
    			add_location(img, file$i, 55, 10, 2021);
    			attr_dev(div2, "class", "landing-intro-screenshot pb-3");
    			add_location(div2, file$i, 54, 8, 1966);
    			attr_dev(div3, "class", "col-lg-7 d-none d-lg-flex mx-auto text-center");
    			add_location(div3, file$i, 53, 6, 1897);
    			attr_dev(div4, "class", "row align-items-center");
    			add_location(div4, file$i, 11, 4, 357);
    			attr_dev(div5, "class", "landing-intro-content container");
    			add_location(div5, file$i, 10, 2, 306);
    			attr_dev(section, "class", "landing-intro landing-bg pt-5 pt-lg-6 pb-5 pb-lg-7");
    			add_location(section, file$i, 9, 0, 234);
    		},
    		m: function mount(target, anchor) {
    			mount_component(homenav, target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, section, anchor);
    			append_hydration_dev(section, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, div1);
    			append_hydration_dev(div1, span);
    			append_hydration_dev(span, t1);
    			append_hydration_dev(div1, t2);
    			append_hydration_dev(div1, h1);
    			append_hydration_dev(h1, t3);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t5);
    			append_hydration_dev(p, br0);
    			append_hydration_dev(p, t6);
    			append_hydration_dev(p, br1);
    			append_hydration_dev(p, t7);
    			append_hydration_dev(div1, t8);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a0);
    			append_hydration_dev(a0, t9);
    			append_hydration_dev(div0, t10);
    			append_hydration_dev(div0, a1);
    			append_hydration_dev(a1, t11);
    			append_hydration_dev(div4, t12);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, img);
    			insert_hydration_dev(target, t13, anchor);
    			mount_component(footer, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					action_destroyer(link.call(null, a0)),
    					action_destroyer(link.call(null, a1)),
    					listen_dev(a1, "click", /*push*/ ctx[0], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(homenav.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(homenav.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(homenav, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(section);
    			if (detaching) detach_dev(t13);
    			destroy_component(footer, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Home', slots, []);
    	const push = () => history.push("/create");
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ link, HomeNav, Footer, push });
    	return [push];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$i, create_fragment$i, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$i.name
    		});
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function commonjsRequire (path) {
    	throw new Error('Could not dynamically require "' + path + '". Please configure the dynamicRequireTargets or/and ignoreDynamicRequires option of @rollup/plugin-commonjs appropriately for this require call to work.');
    }

    var axios$2 = {exports: {}};

    var bind$2 = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };

    var bind$1 = bind$2;

    // utils is a library of generic helper functions non-specific to axios

    var toString = Object.prototype.toString;

    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return Array.isArray(val);
    }

    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    /**
     * Determine if a value is a Buffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Buffer, otherwise false
     */
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
    }

    /**
     * Determine if a value is an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    function isArrayBuffer(val) {
      return toString.call(val) === '[object ArrayBuffer]';
    }

    /**
     * Determine if a value is a FormData
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(val) {
      return toString.call(val) === '[object FormData]';
    }

    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (isArrayBuffer(val.buffer));
      }
      return result;
    }

    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }

    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }

    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    /**
     * Determine if a value is a plain Object
     *
     * @param {Object} val The value to test
     * @return {boolean} True if value is a plain Object, otherwise false
     */
    function isPlainObject(val) {
      if (toString.call(val) !== '[object Object]') {
        return false;
      }

      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }

    /**
     * Determine if a value is a Date
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    function isDate(val) {
      return toString.call(val) === '[object Date]';
    }

    /**
     * Determine if a value is a File
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    function isFile(val) {
      return toString.call(val) === '[object File]';
    }

    /**
     * Determine if a value is a Blob
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    function isBlob(val) {
      return toString.call(val) === '[object Blob]';
    }

    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * Determine if a value is a URLSearchParams object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    function isURLSearchParams(val) {
      return toString.call(val) === '[object URLSearchParams]';
    }

    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.trim ? str.trim() : str.replace(/^\s+|\s+$/g, '');
    }

    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }

      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind$1(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }

    /**
     * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
     *
     * @param {string} content with BOM
     * @return {string} content value without BOM
     */
    function stripBOM(content) {
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return content;
    }

    var utils$e = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isPlainObject: isPlainObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      extend: extend,
      trim: trim,
      stripBOM: stripBOM
    };

    var utils$d = utils$e;

    function encode(val) {
      return encodeURIComponent(val).
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }

    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    var buildURL$2 = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }

      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils$d.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];

        utils$d.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils$d.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }

          utils$d.forEach(val, function parseValue(v) {
            if (utils$d.isDate(v)) {
              v = v.toISOString();
            } else if (utils$d.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });

        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }

        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }

      return url;
    };

    var utils$c = utils$e;

    function InterceptorManager$1() {
      this.handlers = [];
    }

    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager$1.prototype.use = function use(fulfilled, rejected, options) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected,
        synchronous: options ? options.synchronous : false,
        runWhen: options ? options.runWhen : null
      });
      return this.handlers.length - 1;
    };

    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager$1.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };

    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager$1.prototype.forEach = function forEach(fn) {
      utils$c.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };

    var InterceptorManager_1 = InterceptorManager$1;

    var utils$b = utils$e;

    var normalizeHeaderName$1 = function normalizeHeaderName(headers, normalizedName) {
      utils$b.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };

    /**
     * Update an Error with the specified config, error code, and response.
     *
     * @param {Error} error The error to update.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The error.
     */
    var enhanceError$2 = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }

      error.request = request;
      error.response = response;
      error.isAxiosError = true;

      error.toJSON = function toJSON() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code,
          status: this.response && this.response.status ? this.response.status : null
        };
      };
      return error;
    };

    var transitional = {
      silentJSONParsing: true,
      forcedJSONParsing: true,
      clarifyTimeoutError: false
    };

    var enhanceError$1 = enhanceError$2;

    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The created error.
     */
    var createError$2 = function createError(message, config, code, request, response) {
      var error = new Error(message);
      return enhanceError$1(error, config, code, request, response);
    };

    var createError$1 = createError$2;

    /**
     * Resolve or reject a Promise based on response status.
     *
     * @param {Function} resolve A function that resolves the promise.
     * @param {Function} reject A function that rejects the promise.
     * @param {object} response The response.
     */
    var settle$1 = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!response.status || !validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(createError$1(
          'Request failed with status code ' + response.status,
          response.config,
          null,
          response.request,
          response
        ));
      }
    };

    var utils$a = utils$e;

    var cookies$1 = (
      utils$a.isStandardBrowserEnv() ?

      // Standard browser envs support document.cookie
        (function standardBrowserEnv() {
          return {
            write: function write(name, value, expires, path, domain, secure) {
              var cookie = [];
              cookie.push(name + '=' + encodeURIComponent(value));

              if (utils$a.isNumber(expires)) {
                cookie.push('expires=' + new Date(expires).toGMTString());
              }

              if (utils$a.isString(path)) {
                cookie.push('path=' + path);
              }

              if (utils$a.isString(domain)) {
                cookie.push('domain=' + domain);
              }

              if (secure === true) {
                cookie.push('secure');
              }

              document.cookie = cookie.join('; ');
            },

            read: function read(name) {
              var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
              return (match ? decodeURIComponent(match[3]) : null);
            },

            remove: function remove(name) {
              this.write(name, '', Date.now() - 86400000);
            }
          };
        })() :

      // Non standard browser env (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return {
            write: function write() {},
            read: function read() { return null; },
            remove: function remove() {}
          };
        })()
    );

    /**
     * Determines whether the specified URL is absolute
     *
     * @param {string} url The URL to test
     * @returns {boolean} True if the specified URL is absolute, otherwise false
     */
    var isAbsoluteURL$1 = function isAbsoluteURL(url) {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return /^([a-z][a-z\d+\-.]*:)?\/\//i.test(url);
    };

    /**
     * Creates a new URL by combining the specified URLs
     *
     * @param {string} baseURL The base URL
     * @param {string} relativeURL The relative URL
     * @returns {string} The combined URL
     */
    var combineURLs$1 = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };

    var isAbsoluteURL = isAbsoluteURL$1;
    var combineURLs = combineURLs$1;

    /**
     * Creates a new URL by combining the baseURL with the requestedURL,
     * only when the requestedURL is not already an absolute URL.
     * If the requestURL is absolute, this function returns the requestedURL untouched.
     *
     * @param {string} baseURL The base URL
     * @param {string} requestedURL Absolute or relative URL to combine
     * @returns {string} The combined full path
     */
    var buildFullPath$1 = function buildFullPath(baseURL, requestedURL) {
      if (baseURL && !isAbsoluteURL(requestedURL)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };

    var utils$9 = utils$e;

    // Headers whose duplicates are ignored by node
    // c.f. https://nodejs.org/api/http.html#http_message_headers
    var ignoreDuplicateOf = [
      'age', 'authorization', 'content-length', 'content-type', 'etag',
      'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
      'last-modified', 'location', 'max-forwards', 'proxy-authorization',
      'referer', 'retry-after', 'user-agent'
    ];

    /**
     * Parse headers into an object
     *
     * ```
     * Date: Wed, 27 Aug 2014 08:58:49 GMT
     * Content-Type: application/json
     * Connection: keep-alive
     * Transfer-Encoding: chunked
     * ```
     *
     * @param {String} headers Headers needing to be parsed
     * @returns {Object} Headers parsed into an object
     */
    var parseHeaders$1 = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;

      if (!headers) { return parsed; }

      utils$9.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':');
        key = utils$9.trim(line.substr(0, i)).toLowerCase();
        val = utils$9.trim(line.substr(i + 1));

        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === 'set-cookie') {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });

      return parsed;
    };

    var utils$8 = utils$e;

    var isURLSameOrigin$1 = (
      utils$8.isStandardBrowserEnv() ?

      // Standard browser envs have full support of the APIs needed to test
      // whether the request URL is of the same origin as current location.
        (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent);
          var urlParsingNode = document.createElement('a');
          var originURL;

          /**
        * Parse a URL to discover it's components
        *
        * @param {String} url The URL to be parsed
        * @returns {Object}
        */
          function resolveURL(url) {
            var href = url;

            if (msie) {
            // IE needs attribute set twice to normalize properties
              urlParsingNode.setAttribute('href', href);
              href = urlParsingNode.href;
            }

            urlParsingNode.setAttribute('href', href);

            // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
            return {
              href: urlParsingNode.href,
              protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
              host: urlParsingNode.host,
              search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
              hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
              hostname: urlParsingNode.hostname,
              port: urlParsingNode.port,
              pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                urlParsingNode.pathname :
                '/' + urlParsingNode.pathname
            };
          }

          originURL = resolveURL(window.location.href);

          /**
        * Determine if a URL shares the same origin as the current location
        *
        * @param {String} requestURL The URL to test
        * @returns {boolean} True if URL shares the same origin, otherwise false
        */
          return function isURLSameOrigin(requestURL) {
            var parsed = (utils$8.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
            return (parsed.protocol === originURL.protocol &&
                parsed.host === originURL.host);
          };
        })() :

      // Non standard browser envs (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return function isURLSameOrigin() {
            return true;
          };
        })()
    );

    /**
     * A `Cancel` is an object that is thrown when an operation is canceled.
     *
     * @class
     * @param {string=} message The message.
     */
    function Cancel$3(message) {
      this.message = message;
    }

    Cancel$3.prototype.toString = function toString() {
      return 'Cancel' + (this.message ? ': ' + this.message : '');
    };

    Cancel$3.prototype.__CANCEL__ = true;

    var Cancel_1 = Cancel$3;

    var utils$7 = utils$e;
    var settle = settle$1;
    var cookies = cookies$1;
    var buildURL$1 = buildURL$2;
    var buildFullPath = buildFullPath$1;
    var parseHeaders = parseHeaders$1;
    var isURLSameOrigin = isURLSameOrigin$1;
    var createError = createError$2;
    var transitionalDefaults$1 = transitional;
    var Cancel$2 = Cancel_1;

    var xhr = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;
        var responseType = config.responseType;
        var onCanceled;
        function done() {
          if (config.cancelToken) {
            config.cancelToken.unsubscribe(onCanceled);
          }

          if (config.signal) {
            config.signal.removeEventListener('abort', onCanceled);
          }
        }

        if (utils$7.isFormData(requestData)) {
          delete requestHeaders['Content-Type']; // Let the browser set it
        }

        var request = new XMLHttpRequest();

        // HTTP basic authentication
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }

        var fullPath = buildFullPath(config.baseURL, config.url);
        request.open(config.method.toUpperCase(), buildURL$1(fullPath, config.params, config.paramsSerializer), true);

        // Set the request timeout in MS
        request.timeout = config.timeout;

        function onloadend() {
          if (!request) {
            return;
          }
          // Prepare the response
          var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          var responseData = !responseType || responseType === 'text' ||  responseType === 'json' ?
            request.responseText : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config: config,
            request: request
          };

          settle(function _resolve(value) {
            resolve(value);
            done();
          }, function _reject(err) {
            reject(err);
            done();
          }, response);

          // Clean up request
          request = null;
        }

        if ('onloadend' in request) {
          // Use onloadend if available
          request.onloadend = onloadend;
        } else {
          // Listen for ready state to emulate onloadend
          request.onreadystatechange = function handleLoad() {
            if (!request || request.readyState !== 4) {
              return;
            }

            // The request errored out and we didn't get a response, this will be
            // handled by onerror instead
            // With one exception: request that using file: protocol, most browsers
            // will return status as 0 even though it's a successful request
            if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
              return;
            }
            // readystate handler is calling before onerror or ontimeout handlers,
            // so we should call onloadend on the next 'tick'
            setTimeout(onloadend);
          };
        }

        // Handle browser request cancellation (as opposed to a manual cancellation)
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }

          reject(createError('Request aborted', config, 'ECONNABORTED', request));

          // Clean up request
          request = null;
        };

        // Handle low level network errors
        request.onerror = function handleError() {
          // Real errors are hidden from us by the browser
          // onerror should only fire if it's a network error
          reject(createError('Network Error', config, null, request));

          // Clean up request
          request = null;
        };

        // Handle timeout
        request.ontimeout = function handleTimeout() {
          var timeoutErrorMessage = config.timeout ? 'timeout of ' + config.timeout + 'ms exceeded' : 'timeout exceeded';
          var transitional = config.transitional || transitionalDefaults$1;
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          reject(createError(
            timeoutErrorMessage,
            config,
            transitional.clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED',
            request));

          // Clean up request
          request = null;
        };

        // Add xsrf header
        // This is only done if running in a standard browser environment.
        // Specifically not if we're in a web worker, or react-native.
        if (utils$7.isStandardBrowserEnv()) {
          // Add xsrf header
          var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
            cookies.read(config.xsrfCookieName) :
            undefined;

          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }

        // Add headers to the request
        if ('setRequestHeader' in request) {
          utils$7.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              // Remove Content-Type if data is undefined
              delete requestHeaders[key];
            } else {
              // Otherwise add header to the request
              request.setRequestHeader(key, val);
            }
          });
        }

        // Add withCredentials to request if needed
        if (!utils$7.isUndefined(config.withCredentials)) {
          request.withCredentials = !!config.withCredentials;
        }

        // Add responseType to request if needed
        if (responseType && responseType !== 'json') {
          request.responseType = config.responseType;
        }

        // Handle progress if needed
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }

        // Not all browsers support upload events
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }

        if (config.cancelToken || config.signal) {
          // Handle cancellation
          // eslint-disable-next-line func-names
          onCanceled = function(cancel) {
            if (!request) {
              return;
            }
            reject(!cancel || (cancel && cancel.type) ? new Cancel$2('canceled') : cancel);
            request.abort();
            request = null;
          };

          config.cancelToken && config.cancelToken.subscribe(onCanceled);
          if (config.signal) {
            config.signal.aborted ? onCanceled() : config.signal.addEventListener('abort', onCanceled);
          }
        }

        if (!requestData) {
          requestData = null;
        }

        // Send the request
        request.send(requestData);
      });
    };

    var utils$6 = utils$e;
    var normalizeHeaderName = normalizeHeaderName$1;
    var enhanceError = enhanceError$2;
    var transitionalDefaults = transitional;

    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    function setContentTypeIfUnset(headers, value) {
      if (!utils$6.isUndefined(headers) && utils$6.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = xhr;
      } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = xhr;
      }
      return adapter;
    }

    function stringifySafely(rawValue, parser, encoder) {
      if (utils$6.isString(rawValue)) {
        try {
          (parser || JSON.parse)(rawValue);
          return utils$6.trim(rawValue);
        } catch (e) {
          if (e.name !== 'SyntaxError') {
            throw e;
          }
        }
      }

      return (encoder || JSON.stringify)(rawValue);
    }

    var defaults$3 = {

      transitional: transitionalDefaults,

      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');

        if (utils$6.isFormData(data) ||
          utils$6.isArrayBuffer(data) ||
          utils$6.isBuffer(data) ||
          utils$6.isStream(data) ||
          utils$6.isFile(data) ||
          utils$6.isBlob(data)
        ) {
          return data;
        }
        if (utils$6.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils$6.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }
        if (utils$6.isObject(data) || (headers && headers['Content-Type'] === 'application/json')) {
          setContentTypeIfUnset(headers, 'application/json');
          return stringifySafely(data);
        }
        return data;
      }],

      transformResponse: [function transformResponse(data) {
        var transitional = this.transitional || defaults$3.transitional;
        var silentJSONParsing = transitional && transitional.silentJSONParsing;
        var forcedJSONParsing = transitional && transitional.forcedJSONParsing;
        var strictJSONParsing = !silentJSONParsing && this.responseType === 'json';

        if (strictJSONParsing || (forcedJSONParsing && utils$6.isString(data) && data.length)) {
          try {
            return JSON.parse(data);
          } catch (e) {
            if (strictJSONParsing) {
              if (e.name === 'SyntaxError') {
                throw enhanceError(e, this, 'E_JSON_PARSE');
              }
              throw e;
            }
          }
        }

        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,
      maxBodyLength: -1,

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      },

      headers: {
        common: {
          'Accept': 'application/json, text/plain, */*'
        }
      }
    };

    utils$6.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults$3.headers[method] = {};
    });

    utils$6.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults$3.headers[method] = utils$6.merge(DEFAULT_CONTENT_TYPE);
    });

    var defaults_1 = defaults$3;

    var utils$5 = utils$e;
    var defaults$2 = defaults_1;

    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    var transformData$1 = function transformData(data, headers, fns) {
      var context = this || defaults$2;
      /*eslint no-param-reassign:0*/
      utils$5.forEach(fns, function transform(fn) {
        data = fn.call(context, data, headers);
      });

      return data;
    };

    var isCancel$1 = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };

    var utils$4 = utils$e;
    var transformData = transformData$1;
    var isCancel = isCancel$1;
    var defaults$1 = defaults_1;
    var Cancel$1 = Cancel_1;

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }

      if (config.signal && config.signal.aborted) {
        throw new Cancel$1('canceled');
      }
    }

    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    var dispatchRequest$1 = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // Ensure headers exist
      config.headers = config.headers || {};

      // Transform request data
      config.data = transformData.call(
        config,
        config.data,
        config.headers,
        config.transformRequest
      );

      // Flatten headers
      config.headers = utils$4.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );

      utils$4.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );

      var adapter = config.adapter || defaults$1.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData.call(
          config,
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData.call(
              config,
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }

        return Promise.reject(reason);
      });
    };

    var utils$3 = utils$e;

    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    var mergeConfig$2 = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};

      function getMergedValue(target, source) {
        if (utils$3.isPlainObject(target) && utils$3.isPlainObject(source)) {
          return utils$3.merge(target, source);
        } else if (utils$3.isPlainObject(source)) {
          return utils$3.merge({}, source);
        } else if (utils$3.isArray(source)) {
          return source.slice();
        }
        return source;
      }

      // eslint-disable-next-line consistent-return
      function mergeDeepProperties(prop) {
        if (!utils$3.isUndefined(config2[prop])) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (!utils$3.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function valueFromConfig2(prop) {
        if (!utils$3.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function defaultToConfig2(prop) {
        if (!utils$3.isUndefined(config2[prop])) {
          return getMergedValue(undefined, config2[prop]);
        } else if (!utils$3.isUndefined(config1[prop])) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      // eslint-disable-next-line consistent-return
      function mergeDirectKeys(prop) {
        if (prop in config2) {
          return getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          return getMergedValue(undefined, config1[prop]);
        }
      }

      var mergeMap = {
        'url': valueFromConfig2,
        'method': valueFromConfig2,
        'data': valueFromConfig2,
        'baseURL': defaultToConfig2,
        'transformRequest': defaultToConfig2,
        'transformResponse': defaultToConfig2,
        'paramsSerializer': defaultToConfig2,
        'timeout': defaultToConfig2,
        'timeoutMessage': defaultToConfig2,
        'withCredentials': defaultToConfig2,
        'adapter': defaultToConfig2,
        'responseType': defaultToConfig2,
        'xsrfCookieName': defaultToConfig2,
        'xsrfHeaderName': defaultToConfig2,
        'onUploadProgress': defaultToConfig2,
        'onDownloadProgress': defaultToConfig2,
        'decompress': defaultToConfig2,
        'maxContentLength': defaultToConfig2,
        'maxBodyLength': defaultToConfig2,
        'transport': defaultToConfig2,
        'httpAgent': defaultToConfig2,
        'httpsAgent': defaultToConfig2,
        'cancelToken': defaultToConfig2,
        'socketPath': defaultToConfig2,
        'responseEncoding': defaultToConfig2,
        'validateStatus': mergeDirectKeys
      };

      utils$3.forEach(Object.keys(config1).concat(Object.keys(config2)), function computeConfigValue(prop) {
        var merge = mergeMap[prop] || mergeDeepProperties;
        var configValue = merge(prop);
        (utils$3.isUndefined(configValue) && merge !== mergeDirectKeys) || (config[prop] = configValue);
      });

      return config;
    };

    var data = {
      "version": "0.26.1"
    };

    var VERSION = data.version;

    var validators$1 = {};

    // eslint-disable-next-line func-names
    ['object', 'boolean', 'number', 'function', 'string', 'symbol'].forEach(function(type, i) {
      validators$1[type] = function validator(thing) {
        return typeof thing === type || 'a' + (i < 1 ? 'n ' : ' ') + type;
      };
    });

    var deprecatedWarnings = {};

    /**
     * Transitional option validator
     * @param {function|boolean?} validator - set to false if the transitional option has been removed
     * @param {string?} version - deprecated version / removed since version
     * @param {string?} message - some message with additional info
     * @returns {function}
     */
    validators$1.transitional = function transitional(validator, version, message) {
      function formatMessage(opt, desc) {
        return '[Axios v' + VERSION + '] Transitional option \'' + opt + '\'' + desc + (message ? '. ' + message : '');
      }

      // eslint-disable-next-line func-names
      return function(value, opt, opts) {
        if (validator === false) {
          throw new Error(formatMessage(opt, ' has been removed' + (version ? ' in ' + version : '')));
        }

        if (version && !deprecatedWarnings[opt]) {
          deprecatedWarnings[opt] = true;
          // eslint-disable-next-line no-console
          console.warn(
            formatMessage(
              opt,
              ' has been deprecated since v' + version + ' and will be removed in the near future'
            )
          );
        }

        return validator ? validator(value, opt, opts) : true;
      };
    };

    /**
     * Assert object's properties type
     * @param {object} options
     * @param {object} schema
     * @param {boolean?} allowUnknown
     */

    function assertOptions(options, schema, allowUnknown) {
      if (typeof options !== 'object') {
        throw new TypeError('options must be an object');
      }
      var keys = Object.keys(options);
      var i = keys.length;
      while (i-- > 0) {
        var opt = keys[i];
        var validator = schema[opt];
        if (validator) {
          var value = options[opt];
          var result = value === undefined || validator(value, opt, options);
          if (result !== true) {
            throw new TypeError('option ' + opt + ' must be ' + result);
          }
          continue;
        }
        if (allowUnknown !== true) {
          throw Error('Unknown option ' + opt);
        }
      }
    }

    var validator$1 = {
      assertOptions: assertOptions,
      validators: validators$1
    };

    var utils$2 = utils$e;
    var buildURL = buildURL$2;
    var InterceptorManager = InterceptorManager_1;
    var dispatchRequest = dispatchRequest$1;
    var mergeConfig$1 = mergeConfig$2;
    var validator = validator$1;

    var validators = validator.validators;
    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios$1(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager(),
        response: new InterceptorManager()
      };
    }

    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios$1.prototype.request = function request(configOrUrl, config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof configOrUrl === 'string') {
        config = config || {};
        config.url = configOrUrl;
      } else {
        config = configOrUrl || {};
      }

      config = mergeConfig$1(this.defaults, config);

      // Set config.method
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }

      var transitional = config.transitional;

      if (transitional !== undefined) {
        validator.assertOptions(transitional, {
          silentJSONParsing: validators.transitional(validators.boolean),
          forcedJSONParsing: validators.transitional(validators.boolean),
          clarifyTimeoutError: validators.transitional(validators.boolean)
        }, false);
      }

      // filter out skipped interceptors
      var requestInterceptorChain = [];
      var synchronousRequestInterceptors = true;
      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        if (typeof interceptor.runWhen === 'function' && interceptor.runWhen(config) === false) {
          return;
        }

        synchronousRequestInterceptors = synchronousRequestInterceptors && interceptor.synchronous;

        requestInterceptorChain.unshift(interceptor.fulfilled, interceptor.rejected);
      });

      var responseInterceptorChain = [];
      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        responseInterceptorChain.push(interceptor.fulfilled, interceptor.rejected);
      });

      var promise;

      if (!synchronousRequestInterceptors) {
        var chain = [dispatchRequest, undefined];

        Array.prototype.unshift.apply(chain, requestInterceptorChain);
        chain = chain.concat(responseInterceptorChain);

        promise = Promise.resolve(config);
        while (chain.length) {
          promise = promise.then(chain.shift(), chain.shift());
        }

        return promise;
      }


      var newConfig = config;
      while (requestInterceptorChain.length) {
        var onFulfilled = requestInterceptorChain.shift();
        var onRejected = requestInterceptorChain.shift();
        try {
          newConfig = onFulfilled(newConfig);
        } catch (error) {
          onRejected(error);
          break;
        }
      }

      try {
        promise = dispatchRequest(newConfig);
      } catch (error) {
        return Promise.reject(error);
      }

      while (responseInterceptorChain.length) {
        promise = promise.then(responseInterceptorChain.shift(), responseInterceptorChain.shift());
      }

      return promise;
    };

    Axios$1.prototype.getUri = function getUri(config) {
      config = mergeConfig$1(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
    };

    // Provide aliases for supported request methods
    utils$2.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios$1.prototype[method] = function(url, config) {
        return this.request(mergeConfig$1(config || {}, {
          method: method,
          url: url,
          data: (config || {}).data
        }));
      };
    });

    utils$2.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/
      Axios$1.prototype[method] = function(url, data, config) {
        return this.request(mergeConfig$1(config || {}, {
          method: method,
          url: url,
          data: data
        }));
      };
    });

    var Axios_1 = Axios$1;

    var Cancel = Cancel_1;

    /**
     * A `CancelToken` is an object that can be used to request cancellation of an operation.
     *
     * @class
     * @param {Function} executor The executor function.
     */
    function CancelToken(executor) {
      if (typeof executor !== 'function') {
        throw new TypeError('executor must be a function.');
      }

      var resolvePromise;

      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });

      var token = this;

      // eslint-disable-next-line func-names
      this.promise.then(function(cancel) {
        if (!token._listeners) return;

        var i;
        var l = token._listeners.length;

        for (i = 0; i < l; i++) {
          token._listeners[i](cancel);
        }
        token._listeners = null;
      });

      // eslint-disable-next-line func-names
      this.promise.then = function(onfulfilled) {
        var _resolve;
        // eslint-disable-next-line func-names
        var promise = new Promise(function(resolve) {
          token.subscribe(resolve);
          _resolve = resolve;
        }).then(onfulfilled);

        promise.cancel = function reject() {
          token.unsubscribe(_resolve);
        };

        return promise;
      };

      executor(function cancel(message) {
        if (token.reason) {
          // Cancellation has already been requested
          return;
        }

        token.reason = new Cancel(message);
        resolvePromise(token.reason);
      });
    }

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };

    /**
     * Subscribe to the cancel signal
     */

    CancelToken.prototype.subscribe = function subscribe(listener) {
      if (this.reason) {
        listener(this.reason);
        return;
      }

      if (this._listeners) {
        this._listeners.push(listener);
      } else {
        this._listeners = [listener];
      }
    };

    /**
     * Unsubscribe from the cancel signal
     */

    CancelToken.prototype.unsubscribe = function unsubscribe(listener) {
      if (!this._listeners) {
        return;
      }
      var index = this._listeners.indexOf(listener);
      if (index !== -1) {
        this._listeners.splice(index, 1);
      }
    };

    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token: token,
        cancel: cancel
      };
    };

    var CancelToken_1 = CancelToken;

    /**
     * Syntactic sugar for invoking a function and expanding an array for arguments.
     *
     * Common use case would be to use `Function.prototype.apply`.
     *
     *  ```js
     *  function f(x, y, z) {}
     *  var args = [1, 2, 3];
     *  f.apply(null, args);
     *  ```
     *
     * With `spread` this example can be re-written.
     *
     *  ```js
     *  spread(function(x, y, z) {})([1, 2, 3]);
     *  ```
     *
     * @param {Function} callback
     * @returns {Function}
     */
    var spread = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };

    var utils$1 = utils$e;

    /**
     * Determines whether the payload is an error thrown by Axios
     *
     * @param {*} payload The value to test
     * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
     */
    var isAxiosError = function isAxiosError(payload) {
      return utils$1.isObject(payload) && (payload.isAxiosError === true);
    };

    var utils = utils$e;
    var bind = bind$2;
    var Axios = Axios_1;
    var mergeConfig = mergeConfig$2;
    var defaults = defaults_1;

    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios(defaultConfig);
      var instance = bind(Axios.prototype.request, context);

      // Copy axios.prototype to instance
      utils.extend(instance, Axios.prototype, context);

      // Copy context to instance
      utils.extend(instance, context);

      // Factory for creating new instances
      instance.create = function create(instanceConfig) {
        return createInstance(mergeConfig(defaultConfig, instanceConfig));
      };

      return instance;
    }

    // Create the default instance to be exported
    var axios$1 = createInstance(defaults);

    // Expose Axios class to allow class inheritance
    axios$1.Axios = Axios;

    // Expose Cancel & CancelToken
    axios$1.Cancel = Cancel_1;
    axios$1.CancelToken = CancelToken_1;
    axios$1.isCancel = isCancel$1;
    axios$1.VERSION = data.version;

    // Expose all/spread
    axios$1.all = function all(promises) {
      return Promise.all(promises);
    };
    axios$1.spread = spread;

    // Expose isAxiosError
    axios$1.isAxiosError = isAxiosError;

    axios$2.exports = axios$1;

    // Allow use of default import syntax in TypeScript
    axios$2.exports.default = axios$1;

    var axios = axios$2.exports;

    /* src\components\Alert.svelte generated by Svelte v3.47.0 */

    const file$h = "src\\components\\Alert.svelte";

    // (6:0) {#if status === 0}
    function create_if_block_1(ctx) {
    	let div1;
    	let button;
    	let span;
    	let t0;
    	let t1;
    	let div0;
    	let t2;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			button = element("button");
    			span = element("span");
    			t0 = text("×");
    			t1 = space();
    			div0 = element("div");
    			t2 = text(/*mssg*/ ctx[1]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true, role: true });
    			var div1_nodes = children(div1);

    			button = claim_element(div1_nodes, "BUTTON", {
    				type: true,
    				class: true,
    				"data-dismiss": true,
    				"aria-label": true
    			});

    			var button_nodes = children(button);
    			span = claim_element(button_nodes, "SPAN", { "aria-hidden": true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "×");
    			span_nodes.forEach(detach_dev);
    			button_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t2 = claim_text(div0_nodes, /*mssg*/ ctx[1]);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "aria-hidden", "true");
    			add_location(span, file$h, 8, 6, 241);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "close");
    			attr_dev(button, "data-dismiss", "alert");
    			attr_dev(button, "aria-label", "Close");
    			add_location(button, file$h, 7, 4, 157);
    			attr_dev(div0, "class", "alert-message");
    			add_location(div0, file$h, 10, 4, 301);
    			attr_dev(div1, "class", "alert alert-primary alert-dismissible svelte-1ptdg6g");
    			attr_dev(div1, "role", "alert");
    			add_location(div1, file$h, 6, 2, 87);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, button);
    			append_hydration_dev(button, span);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*mssg*/ 2) set_data_dev(t2, /*mssg*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(6:0) {#if status === 0}",
    		ctx
    	});

    	return block;
    }

    // (16:0) {#if status === 1}
    function create_if_block$b(ctx) {
    	let div1;
    	let button;
    	let span;
    	let t0;
    	let t1;
    	let div0;
    	let t2;

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			button = element("button");
    			span = element("span");
    			t0 = text("×");
    			t1 = space();
    			div0 = element("div");
    			t2 = text(/*mssg*/ ctx[1]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true, role: true });
    			var div1_nodes = children(div1);

    			button = claim_element(div1_nodes, "BUTTON", {
    				type: true,
    				class: true,
    				"data-dismiss": true,
    				"aria-label": true
    			});

    			var button_nodes = children(button);
    			span = claim_element(button_nodes, "SPAN", { "aria-hidden": true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "×");
    			span_nodes.forEach(detach_dev);
    			button_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t2 = claim_text(div0_nodes, /*mssg*/ ctx[1]);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "aria-hidden", "true");
    			add_location(span, file$h, 18, 6, 548);
    			attr_dev(button, "type", "button");
    			attr_dev(button, "class", "close");
    			attr_dev(button, "data-dismiss", "alert");
    			attr_dev(button, "aria-label", "Close");
    			add_location(button, file$h, 17, 4, 464);
    			attr_dev(div0, "class", "alert-message");
    			add_location(div0, file$h, 20, 4, 608);
    			attr_dev(div1, "class", "alert alert-danger alert-dismissible svelte-1ptdg6g");
    			attr_dev(div1, "role", "alert");
    			add_location(div1, file$h, 16, 2, 395);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, button);
    			append_hydration_dev(button, span);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, t2);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*mssg*/ 2) set_data_dev(t2, /*mssg*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$b.name,
    		type: "if",
    		source: "(16:0) {#if status === 1}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$h(ctx) {
    	let t;
    	let if_block1_anchor;
    	let if_block0 = /*status*/ ctx[0] === 0 && create_if_block_1(ctx);
    	let if_block1 = /*status*/ ctx[0] === 1 && create_if_block$b(ctx);

    	const block = {
    		c: function create() {
    			if (if_block0) if_block0.c();
    			t = space();
    			if (if_block1) if_block1.c();
    			if_block1_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block0) if_block0.l(nodes);
    			t = claim_space(nodes);
    			if (if_block1) if_block1.l(nodes);
    			if_block1_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block0) if_block0.m(target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			if (if_block1) if_block1.m(target, anchor);
    			insert_hydration_dev(target, if_block1_anchor, anchor);
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*status*/ ctx[0] === 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);
    				} else {
    					if_block0 = create_if_block_1(ctx);
    					if_block0.c();
    					if_block0.m(t.parentNode, t);
    				}
    			} else if (if_block0) {
    				if_block0.d(1);
    				if_block0 = null;
    			}

    			if (/*status*/ ctx[0] === 1) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);
    				} else {
    					if_block1 = create_if_block$b(ctx);
    					if_block1.c();
    					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (if_block0) if_block0.d(detaching);
    			if (detaching) detach_dev(t);
    			if (if_block1) if_block1.d(detaching);
    			if (detaching) detach_dev(if_block1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$h($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Alert', slots, []);
    	let { status } = $$props;
    	let { mssg } = $$props;
    	const writable_props = ['status', 'mssg'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Alert> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('status' in $$props) $$invalidate(0, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(1, mssg = $$props.mssg);
    	};

    	$$self.$capture_state = () => ({ status, mssg });

    	$$self.$inject_state = $$props => {
    		if ('status' in $$props) $$invalidate(0, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(1, mssg = $$props.mssg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [status, mssg];
    }

    class Alert extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$h, create_fragment$h, safe_not_equal, { status: 0, mssg: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Alert",
    			options,
    			id: create_fragment$h.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*status*/ ctx[0] === undefined && !('status' in props)) {
    			console.warn("<Alert> was created without expected prop 'status'");
    		}

    		if (/*mssg*/ ctx[1] === undefined && !('mssg' in props)) {
    			console.warn("<Alert> was created without expected prop 'mssg'");
    		}
    	}

    	get status() {
    		throw new Error("<Alert>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set status(value) {
    		throw new Error("<Alert>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get mssg() {
    		throw new Error("<Alert>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set mssg(value) {
    		throw new Error("<Alert>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function saveToLocalStorage(state) {
      try {
        const serializedState = JSON.stringify(state);
        localStorage.setItem("state", serializedState);
      } catch (e) {
        console.log(e);
      }
    }

    function loadFromLocalStorage() {
      try {
        const serializedState = localStorage.getItem("state");
        if (serializedState === null) return undefined;
        return JSON.parse(serializedState);
      } catch (e) {
        console.log(e);
        return undefined;
      }
    }

    const persistedState = loadFromLocalStorage();

    const userStore = writable(
      persistedState || { token: null, user: null, link: null, schedule: null }
    );

    userStore.subscribe((val) => saveToLocalStorage(val));

    const displayuser = async (name) => {
      let user = null;
      await axios
        .post("/api/user/displayuser", { name })
        .then((res) => {
          user = res.data;
        })
        .catch((err) => {
          console.log(err);
        });
      return user;
    };

    const reset = async (email) => {
      let user;
      await axios
        .post("/api/user/resetpassword", { email })
        .then((res) => {
          user = res.data;
        })
        .catch((err) => {
          user = res.data;
        });
      return user;
    };

    const check = async (email, otp, password) => {
      let user;
      await axios
        .post("/api/user/check", { email, otp, password })
        .then((res) => {
          user = res.data;
        })
        .catch((err) => {
          user = res.data;
        });
      return user;
    };

    const getinfo = async () => {
      let token = "";
      userStore.subscribe((data) => {
        token = data.token;
      });
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      if (token) config.headers["auth-token"] = token;
      await axios.get("/api/user/info", config).then((res) =>
        userStore.update((currUser) => {
          console.log("updated");
          return { ...currUser, token: currUser.token, user: res.data };
        })
      );
    };

    const addlink = async (a) => {
      let token = "";
      let status = 1,
        mssg = "Something went wrong";
      userStore.subscribe((data) => {
        token = data.token;
      });
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      if (token) config.headers["auth-token"] = token;
      console.log(a);
      axios
        .post("/api/user/addlink", a, config)
        .then((res) => {
          status = 0;
          mssg = "Successfully added";
        })
        .catch((err) => {
          console.log(err);
        });
      await getinfo();
      return { status, mssg };
    };

    const deletelink = async (a) => {
      let token = "";
      let status = 1,
        mssg = "Something went wrong";
      userStore.subscribe((data) => {
        token = data.token;
      });
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      if (token) config.headers["auth-token"] = token;
      console.log(a);
      axios
        .post("/api/user/deletelink", { _id: a }, config)
        .then((res) => {
          status = 0;
          mssg = "Successfully added";
        })
        .catch((err) => {
          console.log(err);
        });
      await getinfo();
      return { status, mssg };
    };

    const addschedule = async (a) => {
      let token = "";
      let status = 1,
        mssg = "Something went wrong";
      userStore.subscribe((data) => {
        token = data.token;
      });
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };
      if (token) config.headers["auth-token"] = token;
      console.log(a);
      axios
        .post("/api/user/addschedule", a, config)
        .then((res) => {
          status = 0;
          mssg = "Successfully added";
        })
        .catch((err) => {
          console.log(err);
        });
      await getinfo();
      return { status, mssg };
    };

    /* src\pages\Login.svelte generated by Svelte v3.47.0 */

    const { console: console_1$8 } = globals;
    const file$g = "src\\pages\\Login.svelte";

    // (82:20) {:else}
    function create_else_block$9(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			img = claim_element(nodes, "IMG", {
    				src: true,
    				alt: true,
    				class: true,
    				width: true,
    				height: true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*dp*/ ctx[1])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Not found user");
    			attr_dev(img, "class", "img-fluid rounded-circle");
    			attr_dev(img, "width", "132");
    			attr_dev(img, "height", "132");
    			add_location(img, file$g, 82, 22, 2926);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*dp*/ 2 && !src_url_equal(img.src, img_src_value = /*dp*/ ctx[1])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$9.name,
    		type: "else",
    		source: "(82:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (78:20) {#if loading}
    function create_if_block$a(ctx) {
    	let div;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t = text("Carregando...");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, role: true });
    			var div_nodes = children(div);
    			span = claim_element(div_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "Carregando...");
    			span_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "sr-only");
    			add_location(span, file$g, 79, 24, 2801);
    			attr_dev(div, "class", "spinner-border text-primary");
    			attr_dev(div, "role", "status");
    			add_location(div, file$g, 78, 22, 2720);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, span);
    			append_hydration_dev(span, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$a.name,
    		type: "if",
    		source: "(78:20) {#if loading}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$g(ctx) {
    	let homenav;
    	let t0;
    	let div14;
    	let main;
    	let div13;
    	let div12;
    	let div11;
    	let div10;
    	let div0;
    	let h1;
    	let t1;
    	let t2;
    	let p;
    	let t3;
    	let t4;
    	let div9;
    	let div8;
    	let div7;
    	let div1;
    	let t5;
    	let form;
    	let div2;
    	let label0;
    	let t6;
    	let t7;
    	let input0;
    	let t8;
    	let div3;
    	let label1;
    	let t9;
    	let t10;
    	let input1;
    	let t11;
    	let small;
    	let a;
    	let t12;
    	let t13;
    	let div5;
    	let div4;
    	let input2;
    	let t14;
    	let label2;
    	let t15;
    	let t16;
    	let div6;
    	let button;
    	let t17;
    	let t18;
    	let alert;
    	let t19;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;
    	homenav = new HomeNav({ $$inline: true });

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[2]) return create_if_block$a;
    		return create_else_block$9;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	alert = new Alert({
    			props: {
    				mssg: /*mssg*/ ctx[4],
    				status: /*status*/ ctx[3]
    			},
    			$$inline: true
    		});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(homenav.$$.fragment);
    			t0 = space();
    			div14 = element("div");
    			main = element("main");
    			div13 = element("div");
    			div12 = element("div");
    			div11 = element("div");
    			div10 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t1 = text("Bem vindo novamente");
    			t2 = space();
    			p = element("p");
    			t3 = text("Entre com sua conta para continuar");
    			t4 = space();
    			div9 = element("div");
    			div8 = element("div");
    			div7 = element("div");
    			div1 = element("div");
    			if_block.c();
    			t5 = space();
    			form = element("form");
    			div2 = element("div");
    			label0 = element("label");
    			t6 = text("Instagram");
    			t7 = space();
    			input0 = element("input");
    			t8 = space();
    			div3 = element("div");
    			label1 = element("label");
    			t9 = text("Senha");
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			small = element("small");
    			a = element("a");
    			t12 = text("Esqueceu a senha?");
    			t13 = space();
    			div5 = element("div");
    			div4 = element("div");
    			input2 = element("input");
    			t14 = space();
    			label2 = element("label");
    			t15 = text("Lembrar");
    			t16 = space();
    			div6 = element("div");
    			button = element("button");
    			t17 = text("Entrar");
    			t18 = space();
    			create_component(alert.$$.fragment);
    			t19 = space();
    			create_component(footer.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			claim_component(homenav.$$.fragment, nodes);
    			t0 = claim_space(nodes);
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			main = claim_element(div14_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div13 = claim_element(main_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div0 = claim_element(div10_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t1 = claim_text(h1_nodes, "Bem vindo novamente");
    			h1_nodes.forEach(detach_dev);
    			t2 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, "Entre com sua conta para continuar");
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t4 = claim_space(div10_nodes);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div1 = claim_element(div7_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div7_nodes);
    			form = claim_element(div7_nodes, "FORM", {});
    			var form_nodes = children(form);
    			div2 = claim_element(form_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			label0 = claim_element(div2_nodes, "LABEL", { for: true });
    			var label0_nodes = children(label0);
    			t6 = claim_text(label0_nodes, "Instagram");
    			label0_nodes.forEach(detach_dev);
    			t7 = claim_space(div2_nodes);

    			input0 = claim_element(div2_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div2_nodes.forEach(detach_dev);
    			t8 = claim_space(form_nodes);
    			div3 = claim_element(form_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			label1 = claim_element(div3_nodes, "LABEL", { for: true });
    			var label1_nodes = children(label1);
    			t9 = claim_text(label1_nodes, "Senha");
    			label1_nodes.forEach(detach_dev);
    			t10 = claim_space(div3_nodes);

    			input1 = claim_element(div3_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			t11 = claim_space(div3_nodes);
    			small = claim_element(div3_nodes, "SMALL", {});
    			var small_nodes = children(small);
    			a = claim_element(small_nodes, "A", { replace: true, href: true });
    			var a_nodes = children(a);
    			t12 = claim_text(a_nodes, "Esqueceu a senha?");
    			a_nodes.forEach(detach_dev);
    			small_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t13 = claim_space(form_nodes);
    			div5 = claim_element(form_nodes, "DIV", {});
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			input2 = claim_element(div4_nodes, "INPUT", { type: true, class: true, name: true });
    			t14 = claim_space(div4_nodes);
    			label2 = claim_element(div4_nodes, "LABEL", { for: true, class: true });
    			var label2_nodes = children(label2);
    			t15 = claim_text(label2_nodes, "Lembrar");
    			label2_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t16 = claim_space(form_nodes);
    			div6 = claim_element(form_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			button = claim_element(div6_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t17 = claim_text(button_nodes, "Entrar");
    			button_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			t18 = claim_space(nodes);
    			claim_component(alert.$$.fragment, nodes);
    			t19 = claim_space(nodes);
    			claim_component(footer.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "h2");
    			add_location(h1, file$g, 69, 14, 2376);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$g, 70, 14, 2431);
    			attr_dev(div0, "class", "text-center mt-4");
    			add_location(div0, file$g, 68, 12, 2330);
    			attr_dev(div1, "class", "text-center");
    			add_location(div1, file$g, 76, 18, 2636);
    			attr_dev(label0, "for", "");
    			add_location(label0, file$g, 93, 22, 3336);
    			attr_dev(input0, "class", "form-control form-control-lg");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "usuario");
    			add_location(input0, file$g, 94, 22, 3391);
    			attr_dev(div2, "class", "form-group");
    			add_location(div2, file$g, 92, 20, 3288);
    			attr_dev(label1, "for", "");
    			add_location(label1, file$g, 105, 22, 3845);
    			attr_dev(input1, "class", "form-control form-control-lg");
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "placeholder", "senha");
    			add_location(input1, file$g, 106, 22, 3896);
    			attr_dev(a, "replace", "");
    			attr_dev(a, "href", "/resetpassword");
    			add_location(a, file$g, 113, 24, 4185);
    			add_location(small, file$g, 112, 22, 4152);
    			attr_dev(div3, "class", "form-group");
    			add_location(div3, file$g, 104, 20, 3797);
    			attr_dev(input2, "type", "checkbox");
    			attr_dev(input2, "class", "custom-control-input");
    			input2.value = "remember-me";
    			attr_dev(input2, "name", "remember-me");
    			input2.checked = true;
    			add_location(input2, file$g, 122, 24, 4551);
    			attr_dev(label2, "for", "");
    			attr_dev(label2, "class", "custom-control-label text-small");
    			add_location(label2, file$g, 129, 24, 4838);
    			attr_dev(div4, "class", "custom-control custom-checkbox align-items-center");
    			add_location(div4, file$g, 119, 22, 4413);
    			add_location(div5, file$g, 118, 20, 4384);
    			attr_dev(button, "class", "btn btn-lg btn-primary");
    			add_location(button, file$g, 135, 22, 5095);
    			attr_dev(div6, "class", "text-center mt-3");
    			add_location(div6, file$g, 134, 20, 5041);
    			add_location(form, file$g, 91, 18, 3242);
    			attr_dev(div7, "class", "m-sm-4");
    			add_location(div7, file$g, 75, 16, 2596);
    			attr_dev(div8, "class", "card-body");
    			add_location(div8, file$g, 74, 14, 2555);
    			attr_dev(div9, "class", "card");
    			add_location(div9, file$g, 73, 12, 2521);
    			attr_dev(div10, "class", "align-middle");
    			add_location(div10, file$g, 67, 10, 2290);
    			attr_dev(div11, "class", "col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100");
    			add_location(div11, file$g, 66, 8, 2215);
    			attr_dev(div12, "class", "row h-100");
    			add_location(div12, file$g, 65, 6, 2182);
    			attr_dev(div13, "class", "container d-flex flex-column");
    			add_location(div13, file$g, 64, 4, 2132);
    			attr_dev(main, "class", "content d-flex p-0");
    			add_location(main, file$g, 63, 2, 2093);
    			attr_dev(div14, "class", "main d-flex justify-content-center w-100");
    			add_location(div14, file$g, 62, 0, 2035);
    		},
    		m: function mount(target, anchor) {
    			mount_component(homenav, target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, main);
    			append_hydration_dev(main, div13);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t1);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(div10, t4);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, div1);
    			if_block.m(div1, null);
    			append_hydration_dev(div7, t5);
    			append_hydration_dev(div7, form);
    			append_hydration_dev(form, div2);
    			append_hydration_dev(div2, label0);
    			append_hydration_dev(label0, t6);
    			append_hydration_dev(div2, t7);
    			append_hydration_dev(div2, input0);
    			set_input_value(input0, /*user*/ ctx[0].instagram);
    			append_hydration_dev(form, t8);
    			append_hydration_dev(form, div3);
    			append_hydration_dev(div3, label1);
    			append_hydration_dev(label1, t9);
    			append_hydration_dev(div3, t10);
    			append_hydration_dev(div3, input1);
    			set_input_value(input1, /*user*/ ctx[0].password);
    			append_hydration_dev(div3, t11);
    			append_hydration_dev(div3, small);
    			append_hydration_dev(small, a);
    			append_hydration_dev(a, t12);
    			append_hydration_dev(form, t13);
    			append_hydration_dev(form, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, input2);
    			append_hydration_dev(div4, t14);
    			append_hydration_dev(div4, label2);
    			append_hydration_dev(label2, t15);
    			append_hydration_dev(form, t16);
    			append_hydration_dev(form, div6);
    			append_hydration_dev(div6, button);
    			append_hydration_dev(button, t17);
    			insert_hydration_dev(target, t18, anchor);
    			mount_component(alert, target, anchor);
    			insert_hydration_dev(target, t19, anchor);
    			mount_component(footer, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "change", /*change_handler*/ ctx[7], false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[9]),
    					action_destroyer(link.call(null, a)),
    					listen_dev(form, "submit", /*login*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}

    			if (dirty & /*user*/ 1 && input0.value !== /*user*/ ctx[0].instagram) {
    				set_input_value(input0, /*user*/ ctx[0].instagram);
    			}

    			if (dirty & /*user*/ 1 && input1.value !== /*user*/ ctx[0].password) {
    				set_input_value(input1, /*user*/ ctx[0].password);
    			}

    			const alert_changes = {};
    			if (dirty & /*mssg*/ 16) alert_changes.mssg = /*mssg*/ ctx[4];
    			if (dirty & /*status*/ 8) alert_changes.status = /*status*/ ctx[3];
    			alert.$set(alert_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(homenav.$$.fragment, local);
    			transition_in(alert.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(homenav.$$.fragment, local);
    			transition_out(alert.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(homenav, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div14);
    			if_block.d();
    			if (detaching) detach_dev(t18);
    			destroy_component(alert, detaching);
    			if (detaching) detach_dev(t19);
    			destroy_component(footer, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Login', slots, []);
    	let user = { password: "", instagram: "" };
    	let dp = "img/avatars/avatar.jpg";
    	let loading = false;

    	async function getPhoto(a) {
    		$$invalidate(2, loading = true);
    		let u = await displayuser(user.instagram);
    		console.log(u);
    		if (u) $$invalidate(1, dp = u.dp);
    		$$invalidate(2, loading = false);
    	}

    	let status = -1;
    	let mssg = "";

    	const login = e => {
    		e.preventDefault();

    		fetch("/api/user/login", {
    			method: "POST", // *GET, POST, PUT, DELETE, etc.
    			mode: "cors", // no-cors, *cors, same-origin
    			cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    			credentials: "same-origin", // include, *same-origin, omit
    			headers: { "Content-Type": "application/json" }, // 'Content-Type': 'application/x-www-form-urlencoded',
    			redirect: "follow", // manual, *follow, error
    			referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    			body: JSON.stringify(user)
    		}).then(function (response) {
    			return response.json();
    		}).then(function (data) {
    			console.log(data);

    			if (data.status && data.status == 1) {
    				$$invalidate(3, status = 1);
    				$$invalidate(4, mssg = "Erro");
    				return;
    			}

    			userStore.update(currUser => {
    				return { token: data.token, user: data.user };
    			});

    			document.location.href = "/dashboard";
    		}).catch(error => {
    			$$invalidate(3, status = 1);
    			$$invalidate(4, mssg = "Tivemos algum problema, por favor tente novamente");
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$8.warn(`<Login> was created with unknown prop '${key}'`);
    	});

    	const change_handler = () => {
    		getPhoto(user.instagram);
    	};

    	function input0_input_handler() {
    		user.instagram = this.value;
    		$$invalidate(0, user);
    	}

    	function input1_input_handler() {
    		user.password = this.value;
    		$$invalidate(0, user);
    	}

    	$$self.$capture_state = () => ({
    		link,
    		axios,
    		HomeNav,
    		Footer,
    		Alert,
    		userStore,
    		displayuser,
    		user,
    		dp,
    		loading,
    		getPhoto,
    		status,
    		mssg,
    		login
    	});

    	$$self.$inject_state = $$props => {
    		if ('user' in $$props) $$invalidate(0, user = $$props.user);
    		if ('dp' in $$props) $$invalidate(1, dp = $$props.dp);
    		if ('loading' in $$props) $$invalidate(2, loading = $$props.loading);
    		if ('status' in $$props) $$invalidate(3, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(4, mssg = $$props.mssg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		user,
    		dp,
    		loading,
    		status,
    		mssg,
    		getPhoto,
    		login,
    		change_handler,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class Login extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$g, create_fragment$g, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Login",
    			options,
    			id: create_fragment$g.name
    		});
    	}
    }

    var dist = {};

    var alea$1 = {exports: {}};

    (function (module) {
    // A port of an algorithm by Johannes Baagøe <baagoe@baagoe.com>, 2010
    // http://baagoe.com/en/RandomMusings/javascript/
    // https://github.com/nquinlan/better-random-numbers-for-javascript-mirror
    // Original work is under MIT license -

    // Copyright (C) 2010 by Johannes Baagøe <baagoe@baagoe.org>
    //
    // Permission is hereby granted, free of charge, to any person obtaining a copy
    // of this software and associated documentation files (the "Software"), to deal
    // in the Software without restriction, including without limitation the rights
    // to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    // copies of the Software, and to permit persons to whom the Software is
    // furnished to do so, subject to the following conditions:
    //
    // The above copyright notice and this permission notice shall be included in
    // all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    // IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    // FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    // LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    // OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
    // THE SOFTWARE.



    (function(global, module, define) {

    function Alea(seed) {
      var me = this, mash = Mash();

      me.next = function() {
        var t = 2091639 * me.s0 + me.c * 2.3283064365386963e-10; // 2^-32
        me.s0 = me.s1;
        me.s1 = me.s2;
        return me.s2 = t - (me.c = t | 0);
      };

      // Apply the seeding algorithm from Baagoe.
      me.c = 1;
      me.s0 = mash(' ');
      me.s1 = mash(' ');
      me.s2 = mash(' ');
      me.s0 -= mash(seed);
      if (me.s0 < 0) { me.s0 += 1; }
      me.s1 -= mash(seed);
      if (me.s1 < 0) { me.s1 += 1; }
      me.s2 -= mash(seed);
      if (me.s2 < 0) { me.s2 += 1; }
      mash = null;
    }

    function copy(f, t) {
      t.c = f.c;
      t.s0 = f.s0;
      t.s1 = f.s1;
      t.s2 = f.s2;
      return t;
    }

    function impl(seed, opts) {
      var xg = new Alea(seed),
          state = opts && opts.state,
          prng = xg.next;
      prng.int32 = function() { return (xg.next() * 0x100000000) | 0; };
      prng.double = function() {
        return prng() + (prng() * 0x200000 | 0) * 1.1102230246251565e-16; // 2^-53
      };
      prng.quick = prng;
      if (state) {
        if (typeof(state) == 'object') copy(state, xg);
        prng.state = function() { return copy(xg, {}); };
      }
      return prng;
    }

    function Mash() {
      var n = 0xefc8249d;

      var mash = function(data) {
        data = String(data);
        for (var i = 0; i < data.length; i++) {
          n += data.charCodeAt(i);
          var h = 0.02519603282416938 * n;
          n = h >>> 0;
          h -= n;
          h *= n;
          n = h >>> 0;
          h -= n;
          n += h * 0x100000000; // 2^32
        }
        return (n >>> 0) * 2.3283064365386963e-10; // 2^-32
      };

      return mash;
    }


    if (module && module.exports) {
      module.exports = impl;
    } else if (define && define.amd) {
      define(function() { return impl; });
    } else {
      this.alea = impl;
    }

    })(
      commonjsGlobal,
      module,    // present in node.js
      (typeof undefined) == 'function'    // present with an AMD loader
    );
    }(alea$1));

    var xor128$1 = {exports: {}};

    (function (module) {
    // A Javascript implementaion of the "xor128" prng algorithm by
    // George Marsaglia.  See http://www.jstatsoft.org/v08/i14/paper

    (function(global, module, define) {

    function XorGen(seed) {
      var me = this, strseed = '';

      me.x = 0;
      me.y = 0;
      me.z = 0;
      me.w = 0;

      // Set up generator function.
      me.next = function() {
        var t = me.x ^ (me.x << 11);
        me.x = me.y;
        me.y = me.z;
        me.z = me.w;
        return me.w ^= (me.w >>> 19) ^ t ^ (t >>> 8);
      };

      if (seed === (seed | 0)) {
        // Integer seed.
        me.x = seed;
      } else {
        // String seed.
        strseed += seed;
      }

      // Mix in string seed, then discard an initial batch of 64 values.
      for (var k = 0; k < strseed.length + 64; k++) {
        me.x ^= strseed.charCodeAt(k) | 0;
        me.next();
      }
    }

    function copy(f, t) {
      t.x = f.x;
      t.y = f.y;
      t.z = f.z;
      t.w = f.w;
      return t;
    }

    function impl(seed, opts) {
      var xg = new XorGen(seed),
          state = opts && opts.state,
          prng = function() { return (xg.next() >>> 0) / 0x100000000; };
      prng.double = function() {
        do {
          var top = xg.next() >>> 11,
              bot = (xg.next() >>> 0) / 0x100000000,
              result = (top + bot) / (1 << 21);
        } while (result === 0);
        return result;
      };
      prng.int32 = xg.next;
      prng.quick = prng;
      if (state) {
        if (typeof(state) == 'object') copy(state, xg);
        prng.state = function() { return copy(xg, {}); };
      }
      return prng;
    }

    if (module && module.exports) {
      module.exports = impl;
    } else if (define && define.amd) {
      define(function() { return impl; });
    } else {
      this.xor128 = impl;
    }

    })(
      commonjsGlobal,
      module,    // present in node.js
      (typeof undefined) == 'function'    // present with an AMD loader
    );
    }(xor128$1));

    var xorwow$1 = {exports: {}};

    (function (module) {
    // A Javascript implementaion of the "xorwow" prng algorithm by
    // George Marsaglia.  See http://www.jstatsoft.org/v08/i14/paper

    (function(global, module, define) {

    function XorGen(seed) {
      var me = this, strseed = '';

      // Set up generator function.
      me.next = function() {
        var t = (me.x ^ (me.x >>> 2));
        me.x = me.y; me.y = me.z; me.z = me.w; me.w = me.v;
        return (me.d = (me.d + 362437 | 0)) +
           (me.v = (me.v ^ (me.v << 4)) ^ (t ^ (t << 1))) | 0;
      };

      me.x = 0;
      me.y = 0;
      me.z = 0;
      me.w = 0;
      me.v = 0;

      if (seed === (seed | 0)) {
        // Integer seed.
        me.x = seed;
      } else {
        // String seed.
        strseed += seed;
      }

      // Mix in string seed, then discard an initial batch of 64 values.
      for (var k = 0; k < strseed.length + 64; k++) {
        me.x ^= strseed.charCodeAt(k) | 0;
        if (k == strseed.length) {
          me.d = me.x << 10 ^ me.x >>> 4;
        }
        me.next();
      }
    }

    function copy(f, t) {
      t.x = f.x;
      t.y = f.y;
      t.z = f.z;
      t.w = f.w;
      t.v = f.v;
      t.d = f.d;
      return t;
    }

    function impl(seed, opts) {
      var xg = new XorGen(seed),
          state = opts && opts.state,
          prng = function() { return (xg.next() >>> 0) / 0x100000000; };
      prng.double = function() {
        do {
          var top = xg.next() >>> 11,
              bot = (xg.next() >>> 0) / 0x100000000,
              result = (top + bot) / (1 << 21);
        } while (result === 0);
        return result;
      };
      prng.int32 = xg.next;
      prng.quick = prng;
      if (state) {
        if (typeof(state) == 'object') copy(state, xg);
        prng.state = function() { return copy(xg, {}); };
      }
      return prng;
    }

    if (module && module.exports) {
      module.exports = impl;
    } else if (define && define.amd) {
      define(function() { return impl; });
    } else {
      this.xorwow = impl;
    }

    })(
      commonjsGlobal,
      module,    // present in node.js
      (typeof undefined) == 'function'    // present with an AMD loader
    );
    }(xorwow$1));

    var xorshift7$1 = {exports: {}};

    (function (module) {
    // A Javascript implementaion of the "xorshift7" algorithm by
    // François Panneton and Pierre L'ecuyer:
    // "On the Xorgshift Random Number Generators"
    // http://saluc.engr.uconn.edu/refs/crypto/rng/panneton05onthexorshift.pdf

    (function(global, module, define) {

    function XorGen(seed) {
      var me = this;

      // Set up generator function.
      me.next = function() {
        // Update xor generator.
        var X = me.x, i = me.i, t, v;
        t = X[i]; t ^= (t >>> 7); v = t ^ (t << 24);
        t = X[(i + 1) & 7]; v ^= t ^ (t >>> 10);
        t = X[(i + 3) & 7]; v ^= t ^ (t >>> 3);
        t = X[(i + 4) & 7]; v ^= t ^ (t << 7);
        t = X[(i + 7) & 7]; t = t ^ (t << 13); v ^= t ^ (t << 9);
        X[i] = v;
        me.i = (i + 1) & 7;
        return v;
      };

      function init(me, seed) {
        var j, X = [];

        if (seed === (seed | 0)) {
          // Seed state array using a 32-bit integer.
          X[0] = seed;
        } else {
          // Seed state using a string.
          seed = '' + seed;
          for (j = 0; j < seed.length; ++j) {
            X[j & 7] = (X[j & 7] << 15) ^
                (seed.charCodeAt(j) + X[(j + 1) & 7] << 13);
          }
        }
        // Enforce an array length of 8, not all zeroes.
        while (X.length < 8) X.push(0);
        for (j = 0; j < 8 && X[j] === 0; ++j);
        if (j == 8) X[7] = -1;

        me.x = X;
        me.i = 0;

        // Discard an initial 256 values.
        for (j = 256; j > 0; --j) {
          me.next();
        }
      }

      init(me, seed);
    }

    function copy(f, t) {
      t.x = f.x.slice();
      t.i = f.i;
      return t;
    }

    function impl(seed, opts) {
      if (seed == null) seed = +(new Date);
      var xg = new XorGen(seed),
          state = opts && opts.state,
          prng = function() { return (xg.next() >>> 0) / 0x100000000; };
      prng.double = function() {
        do {
          var top = xg.next() >>> 11,
              bot = (xg.next() >>> 0) / 0x100000000,
              result = (top + bot) / (1 << 21);
        } while (result === 0);
        return result;
      };
      prng.int32 = xg.next;
      prng.quick = prng;
      if (state) {
        if (state.x) copy(state, xg);
        prng.state = function() { return copy(xg, {}); };
      }
      return prng;
    }

    if (module && module.exports) {
      module.exports = impl;
    } else if (define && define.amd) {
      define(function() { return impl; });
    } else {
      this.xorshift7 = impl;
    }

    })(
      commonjsGlobal,
      module,    // present in node.js
      (typeof undefined) == 'function'    // present with an AMD loader
    );
    }(xorshift7$1));

    var xor4096$1 = {exports: {}};

    (function (module) {
    // A Javascript implementaion of Richard Brent's Xorgens xor4096 algorithm.
    //
    // This fast non-cryptographic random number generator is designed for
    // use in Monte-Carlo algorithms. It combines a long-period xorshift
    // generator with a Weyl generator, and it passes all common batteries
    // of stasticial tests for randomness while consuming only a few nanoseconds
    // for each prng generated.  For background on the generator, see Brent's
    // paper: "Some long-period random number generators using shifts and xors."
    // http://arxiv.org/pdf/1004.3115v1.pdf
    //
    // Usage:
    //
    // var xor4096 = require('xor4096');
    // random = xor4096(1);                        // Seed with int32 or string.
    // assert.equal(random(), 0.1520436450538547); // (0, 1) range, 53 bits.
    // assert.equal(random.int32(), 1806534897);   // signed int32, 32 bits.
    //
    // For nonzero numeric keys, this impelementation provides a sequence
    // identical to that by Brent's xorgens 3 implementaion in C.  This
    // implementation also provides for initalizing the generator with
    // string seeds, or for saving and restoring the state of the generator.
    //
    // On Chrome, this prng benchmarks about 2.1 times slower than
    // Javascript's built-in Math.random().

    (function(global, module, define) {

    function XorGen(seed) {
      var me = this;

      // Set up generator function.
      me.next = function() {
        var w = me.w,
            X = me.X, i = me.i, t, v;
        // Update Weyl generator.
        me.w = w = (w + 0x61c88647) | 0;
        // Update xor generator.
        v = X[(i + 34) & 127];
        t = X[i = ((i + 1) & 127)];
        v ^= v << 13;
        t ^= t << 17;
        v ^= v >>> 15;
        t ^= t >>> 12;
        // Update Xor generator array state.
        v = X[i] = v ^ t;
        me.i = i;
        // Result is the combination.
        return (v + (w ^ (w >>> 16))) | 0;
      };

      function init(me, seed) {
        var t, v, i, j, w, X = [], limit = 128;
        if (seed === (seed | 0)) {
          // Numeric seeds initialize v, which is used to generates X.
          v = seed;
          seed = null;
        } else {
          // String seeds are mixed into v and X one character at a time.
          seed = seed + '\0';
          v = 0;
          limit = Math.max(limit, seed.length);
        }
        // Initialize circular array and weyl value.
        for (i = 0, j = -32; j < limit; ++j) {
          // Put the unicode characters into the array, and shuffle them.
          if (seed) v ^= seed.charCodeAt((j + 32) % seed.length);
          // After 32 shuffles, take v as the starting w value.
          if (j === 0) w = v;
          v ^= v << 10;
          v ^= v >>> 15;
          v ^= v << 4;
          v ^= v >>> 13;
          if (j >= 0) {
            w = (w + 0x61c88647) | 0;     // Weyl.
            t = (X[j & 127] ^= (v + w));  // Combine xor and weyl to init array.
            i = (0 == t) ? i + 1 : 0;     // Count zeroes.
          }
        }
        // We have detected all zeroes; make the key nonzero.
        if (i >= 128) {
          X[(seed && seed.length || 0) & 127] = -1;
        }
        // Run the generator 512 times to further mix the state before using it.
        // Factoring this as a function slows the main generator, so it is just
        // unrolled here.  The weyl generator is not advanced while warming up.
        i = 127;
        for (j = 4 * 128; j > 0; --j) {
          v = X[(i + 34) & 127];
          t = X[i = ((i + 1) & 127)];
          v ^= v << 13;
          t ^= t << 17;
          v ^= v >>> 15;
          t ^= t >>> 12;
          X[i] = v ^ t;
        }
        // Storing state as object members is faster than using closure variables.
        me.w = w;
        me.X = X;
        me.i = i;
      }

      init(me, seed);
    }

    function copy(f, t) {
      t.i = f.i;
      t.w = f.w;
      t.X = f.X.slice();
      return t;
    }
    function impl(seed, opts) {
      if (seed == null) seed = +(new Date);
      var xg = new XorGen(seed),
          state = opts && opts.state,
          prng = function() { return (xg.next() >>> 0) / 0x100000000; };
      prng.double = function() {
        do {
          var top = xg.next() >>> 11,
              bot = (xg.next() >>> 0) / 0x100000000,
              result = (top + bot) / (1 << 21);
        } while (result === 0);
        return result;
      };
      prng.int32 = xg.next;
      prng.quick = prng;
      if (state) {
        if (state.X) copy(state, xg);
        prng.state = function() { return copy(xg, {}); };
      }
      return prng;
    }

    if (module && module.exports) {
      module.exports = impl;
    } else if (define && define.amd) {
      define(function() { return impl; });
    } else {
      this.xor4096 = impl;
    }

    })(
      commonjsGlobal,                                     // window object or global
      module,    // present in node.js
      (typeof undefined) == 'function'    // present with an AMD loader
    );
    }(xor4096$1));

    var tychei$1 = {exports: {}};

    (function (module) {
    // A Javascript implementaion of the "Tyche-i" prng algorithm by
    // Samuel Neves and Filipe Araujo.
    // See https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf

    (function(global, module, define) {

    function XorGen(seed) {
      var me = this, strseed = '';

      // Set up generator function.
      me.next = function() {
        var b = me.b, c = me.c, d = me.d, a = me.a;
        b = (b << 25) ^ (b >>> 7) ^ c;
        c = (c - d) | 0;
        d = (d << 24) ^ (d >>> 8) ^ a;
        a = (a - b) | 0;
        me.b = b = (b << 20) ^ (b >>> 12) ^ c;
        me.c = c = (c - d) | 0;
        me.d = (d << 16) ^ (c >>> 16) ^ a;
        return me.a = (a - b) | 0;
      };

      /* The following is non-inverted tyche, which has better internal
       * bit diffusion, but which is about 25% slower than tyche-i in JS.
      me.next = function() {
        var a = me.a, b = me.b, c = me.c, d = me.d;
        a = (me.a + me.b | 0) >>> 0;
        d = me.d ^ a; d = d << 16 ^ d >>> 16;
        c = me.c + d | 0;
        b = me.b ^ c; b = b << 12 ^ d >>> 20;
        me.a = a = a + b | 0;
        d = d ^ a; me.d = d = d << 8 ^ d >>> 24;
        me.c = c = c + d | 0;
        b = b ^ c;
        return me.b = (b << 7 ^ b >>> 25);
      }
      */

      me.a = 0;
      me.b = 0;
      me.c = 2654435769 | 0;
      me.d = 1367130551;

      if (seed === Math.floor(seed)) {
        // Integer seed.
        me.a = (seed / 0x100000000) | 0;
        me.b = seed | 0;
      } else {
        // String seed.
        strseed += seed;
      }

      // Mix in string seed, then discard an initial batch of 64 values.
      for (var k = 0; k < strseed.length + 20; k++) {
        me.b ^= strseed.charCodeAt(k) | 0;
        me.next();
      }
    }

    function copy(f, t) {
      t.a = f.a;
      t.b = f.b;
      t.c = f.c;
      t.d = f.d;
      return t;
    }
    function impl(seed, opts) {
      var xg = new XorGen(seed),
          state = opts && opts.state,
          prng = function() { return (xg.next() >>> 0) / 0x100000000; };
      prng.double = function() {
        do {
          var top = xg.next() >>> 11,
              bot = (xg.next() >>> 0) / 0x100000000,
              result = (top + bot) / (1 << 21);
        } while (result === 0);
        return result;
      };
      prng.int32 = xg.next;
      prng.quick = prng;
      if (state) {
        if (typeof(state) == 'object') copy(state, xg);
        prng.state = function() { return copy(xg, {}); };
      }
      return prng;
    }

    if (module && module.exports) {
      module.exports = impl;
    } else if (define && define.amd) {
      define(function() { return impl; });
    } else {
      this.tychei = impl;
    }

    })(
      commonjsGlobal,
      module,    // present in node.js
      (typeof undefined) == 'function'    // present with an AMD loader
    );
    }(tychei$1));

    var seedrandom$1 = {exports: {}};

    /*
    Copyright 2019 David Bau.

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
    IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
    CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
    TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
    SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

    */

    (function (module) {
    (function (global, pool, math) {
    //
    // The following constants are related to IEEE 754 limits.
    //

    var width = 256,        // each RC4 output is 0 <= x < 256
        chunks = 6,         // at least six RC4 outputs for each double
        digits = 52,        // there are 52 significant digits in a double
        rngname = 'random', // rngname: name for Math.random and Math.seedrandom
        startdenom = math.pow(width, chunks),
        significance = math.pow(2, digits),
        overflow = significance * 2,
        mask = width - 1,
        nodecrypto;         // node.js crypto module, initialized at the bottom.

    //
    // seedrandom()
    // This is the seedrandom function described above.
    //
    function seedrandom(seed, options, callback) {
      var key = [];
      options = (options == true) ? { entropy: true } : (options || {});

      // Flatten the seed string or build one from local entropy if needed.
      var shortseed = mixkey(flatten(
        options.entropy ? [seed, tostring(pool)] :
        (seed == null) ? autoseed() : seed, 3), key);

      // Use the seed to initialize an ARC4 generator.
      var arc4 = new ARC4(key);

      // This function returns a random double in [0, 1) that contains
      // randomness in every bit of the mantissa of the IEEE 754 value.
      var prng = function() {
        var n = arc4.g(chunks),             // Start with a numerator n < 2 ^ 48
            d = startdenom,                 //   and denominator d = 2 ^ 48.
            x = 0;                          //   and no 'extra last byte'.
        while (n < significance) {          // Fill up all significant digits by
          n = (n + x) * width;              //   shifting numerator and
          d *= width;                       //   denominator and generating a
          x = arc4.g(1);                    //   new least-significant-byte.
        }
        while (n >= overflow) {             // To avoid rounding up, before adding
          n /= 2;                           //   last byte, shift everything
          d /= 2;                           //   right using integer math until
          x >>>= 1;                         //   we have exactly the desired bits.
        }
        return (n + x) / d;                 // Form the number within [0, 1).
      };

      prng.int32 = function() { return arc4.g(4) | 0; };
      prng.quick = function() { return arc4.g(4) / 0x100000000; };
      prng.double = prng;

      // Mix the randomness into accumulated entropy.
      mixkey(tostring(arc4.S), pool);

      // Calling convention: what to return as a function of prng, seed, is_math.
      return (options.pass || callback ||
          function(prng, seed, is_math_call, state) {
            if (state) {
              // Load the arc4 state from the given state if it has an S array.
              if (state.S) { copy(state, arc4); }
              // Only provide the .state method if requested via options.state.
              prng.state = function() { return copy(arc4, {}); };
            }

            // If called as a method of Math (Math.seedrandom()), mutate
            // Math.random because that is how seedrandom.js has worked since v1.0.
            if (is_math_call) { math[rngname] = prng; return seed; }

            // Otherwise, it is a newer calling convention, so return the
            // prng directly.
            else return prng;
          })(
      prng,
      shortseed,
      'global' in options ? options.global : (this == math),
      options.state);
    }

    //
    // ARC4
    //
    // An ARC4 implementation.  The constructor takes a key in the form of
    // an array of at most (width) integers that should be 0 <= x < (width).
    //
    // The g(count) method returns a pseudorandom integer that concatenates
    // the next (count) outputs from ARC4.  Its return value is a number x
    // that is in the range 0 <= x < (width ^ count).
    //
    function ARC4(key) {
      var t, keylen = key.length,
          me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];

      // The empty key [] is treated as [0].
      if (!keylen) { key = [keylen++]; }

      // Set up S using the standard key scheduling algorithm.
      while (i < width) {
        s[i] = i++;
      }
      for (i = 0; i < width; i++) {
        s[i] = s[j = mask & (j + key[i % keylen] + (t = s[i]))];
        s[j] = t;
      }

      // The "g" method returns the next (count) outputs as one number.
      (me.g = function(count) {
        // Using instance members instead of closure state nearly doubles speed.
        var t, r = 0,
            i = me.i, j = me.j, s = me.S;
        while (count--) {
          t = s[i = mask & (i + 1)];
          r = r * width + s[mask & ((s[i] = s[j = mask & (j + t)]) + (s[j] = t))];
        }
        me.i = i; me.j = j;
        return r;
        // For robust unpredictability, the function call below automatically
        // discards an initial batch of values.  This is called RC4-drop[256].
        // See http://google.com/search?q=rsa+fluhrer+response&btnI
      })(width);
    }

    //
    // copy()
    // Copies internal state of ARC4 to or from a plain object.
    //
    function copy(f, t) {
      t.i = f.i;
      t.j = f.j;
      t.S = f.S.slice();
      return t;
    }
    //
    // flatten()
    // Converts an object tree to nested arrays of strings.
    //
    function flatten(obj, depth) {
      var result = [], typ = (typeof obj), prop;
      if (depth && typ == 'object') {
        for (prop in obj) {
          try { result.push(flatten(obj[prop], depth - 1)); } catch (e) {}
        }
      }
      return (result.length ? result : typ == 'string' ? obj : obj + '\0');
    }

    //
    // mixkey()
    // Mixes a string seed into a key that is an array of integers, and
    // returns a shortened string seed that is equivalent to the result key.
    //
    function mixkey(seed, key) {
      var stringseed = seed + '', smear, j = 0;
      while (j < stringseed.length) {
        key[mask & j] =
          mask & ((smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++));
      }
      return tostring(key);
    }

    //
    // autoseed()
    // Returns an object for autoseeding, using window.crypto and Node crypto
    // module if available.
    //
    function autoseed() {
      try {
        var out;
        if (nodecrypto && (out = nodecrypto.randomBytes)) {
          // The use of 'out' to remember randomBytes makes tight minified code.
          out = out(width);
        } else {
          out = new Uint8Array(width);
          (global.crypto || global.msCrypto).getRandomValues(out);
        }
        return tostring(out);
      } catch (e) {
        var browser = global.navigator,
            plugins = browser && browser.plugins;
        return [+new Date, global, plugins, global.screen, tostring(pool)];
      }
    }

    //
    // tostring()
    // Converts an array of charcodes to a string
    //
    function tostring(a) {
      return String.fromCharCode.apply(0, a);
    }

    //
    // When seedrandom.js is loaded, we immediately mix a few bits
    // from the built-in RNG into the entropy pool.  Because we do
    // not want to interfere with deterministic PRNG state later,
    // seedrandom will not call math.random on its own again after
    // initialization.
    //
    mixkey(math.random(), pool);

    //
    // Nodejs and AMD support: export the implementation as a module using
    // either convention.
    //
    if (module.exports) {
      module.exports = seedrandom;
      // When in node.js, try using crypto package for autoseeding.
      try {
        nodecrypto = require('crypto');
      } catch (ex) {}
    } else {
      // When included as a plain script, set up Math.seedrandom global.
      math['seed' + rngname] = seedrandom;
    }


    // End anonymous scope, and pass initial values.
    })(
      // global: `self` in browsers (including strict mode and web workers),
      // otherwise `this` in Node and other environments
      (typeof self !== 'undefined') ? self : commonjsGlobal,
      [],     // pool: entropy pool starts empty
      Math    // math: package containing random, pow, and seedrandom
    );
    }(seedrandom$1));

    // A library of seedable RNGs implemented in Javascript.
    //
    // Usage:
    //
    // var seedrandom = require('seedrandom');
    // var random = seedrandom(1); // or any seed.
    // var x = random();       // 0 <= x < 1.  Every bit is random.
    // var x = random.quick(); // 0 <= x < 1.  32 bits of randomness.

    // alea, a 53-bit multiply-with-carry generator by Johannes Baagøe.
    // Period: ~2^116
    // Reported to pass all BigCrush tests.
    var alea = alea$1.exports;

    // xor128, a pure xor-shift generator by George Marsaglia.
    // Period: 2^128-1.
    // Reported to fail: MatrixRank and LinearComp.
    var xor128 = xor128$1.exports;

    // xorwow, George Marsaglia's 160-bit xor-shift combined plus weyl.
    // Period: 2^192-2^32
    // Reported to fail: CollisionOver, SimpPoker, and LinearComp.
    var xorwow = xorwow$1.exports;

    // xorshift7, by François Panneton and Pierre L'ecuyer, takes
    // a different approach: it adds robustness by allowing more shifts
    // than Marsaglia's original three.  It is a 7-shift generator
    // with 256 bits, that passes BigCrush with no systmatic failures.
    // Period 2^256-1.
    // No systematic BigCrush failures reported.
    var xorshift7 = xorshift7$1.exports;

    // xor4096, by Richard Brent, is a 4096-bit xor-shift with a
    // very long period that also adds a Weyl generator. It also passes
    // BigCrush with no systematic failures.  Its long period may
    // be useful if you have many generators and need to avoid
    // collisions.
    // Period: 2^4128-2^32.
    // No systematic BigCrush failures reported.
    var xor4096 = xor4096$1.exports;

    // Tyche-i, by Samuel Neves and Filipe Araujo, is a bit-shifting random
    // number generator derived from ChaCha, a modern stream cipher.
    // https://eden.dei.uc.pt/~sneves/pubs/2011-snfa2.pdf
    // Period: ~2^127
    // No systematic BigCrush failures reported.
    var tychei = tychei$1.exports;

    // The original ARC4-based prng included in this library.
    // Period: ~2^1600
    var sr = seedrandom$1.exports;

    sr.alea = alea;
    sr.xor128 = xor128;
    sr.xorwow = xorwow;
    sr.xorshift7 = xorshift7;
    sr.xor4096 = xor4096;
    sr.tychei = tychei;

    var seedrandom = sr;

    var __importDefault = (commonjsGlobal && commonjsGlobal.__importDefault) || function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };
    Object.defineProperty(dist, "__esModule", { value: true });
    var AvatarGenerator_1 = dist.AvatarGenerator = void 0;
    var seedrandom_1 = __importDefault(seedrandom);
    /** @description Class to generate avatars  */
    var AvatarGenerator = /** @class */ (function () {
        function AvatarGenerator() {
        }
        /** @description Generates random avatar image URL
         * @returns Random avatar image URL
         */
        AvatarGenerator.prototype.generateRandomAvatar = function (seed) {
            var topTypeOptions = new Array();
            topTypeOptions.push("NoHair", "Eyepatch", "Hat", "Hijab", "Turban", "WinterHat1", "WinterHat2", "WinterHat3", "WinterHat4", "LongHairBigHair", "LongHairBob", "LongHairBun", "LongHairCurly", "LongHairCurvy", "LongHairDreads", "LongHairFrida", "LongHairFro", "LongHairFroBand", "LongHairNotTooLong", "LongHairShavedSides", "LongHairMiaWallace", "LongHairStraight", "LongHairStraight2", "LongHairStraightStrand", "ShortHairDreads01", "ShortHairDreads02", "ShortHairFrizzle", "ShortHairShaggyMullet", "ShortHairShortCurly", "ShortHairShortFlat", "ShortHairShortRound", "ShortHairShortWaved", "ShortHairSides", "ShortHairTheCaesar", "ShortHairTheCaesarSidePart");
            var accessoriesTypeOptions = new Array();
            accessoriesTypeOptions.push("Blank", "Kurt", "Prescription01", "Prescription02", "Round", "Sunglasses", "Wayfarers");
            var facialHairTypeOptions = new Array();
            facialHairTypeOptions.push("Blank", "BeardMedium", "BeardLight", "BeardMagestic", "MoustacheFancy", "MoustacheMagnum");
            var facialHairColorOptions = new Array();
            facialHairColorOptions.push("Auburn", "Black", "Blonde", "BlondeGolden", "Brown", "BrownDark", "Platinum", "Red");
            var clotheTypeOptions = new Array();
            clotheTypeOptions.push("BlazerShirt", "BlazerSweater", "CollarSweater", "GraphicShirt", "Hoodie", "Overall", "ShirtCrewNeck", "ShirtScoopNeck", "ShirtVNeck");
            var eyeTypeOptions = new Array();
            eyeTypeOptions.push("Close", "Cry", "Default", "Dizzy", "EyeRoll", "Happy", "Hearts", "Side", "Squint", "Surprised", "Wink", "WinkWacky");
            var eyebrowTypeOptions = new Array();
            eyebrowTypeOptions.push("Angry", "AngryNatural", "Default", "DefaultNatural", "FlatNatural", "RaisedExcited", "RaisedExcitedNatural", "SadConcerned", "SadConcernedNatural", "UnibrowNatural", "UpDown", "UpDownNatural");
            var mouthTypeOptions = new Array();
            mouthTypeOptions.push("Concerned", "Default", "Disbelief", "Eating", "Grimace", "Sad", "ScreamOpen", "Serious", "Smile", "Tongue", "Twinkle", "Vomit");
            var skinColorOptions = new Array();
            skinColorOptions.push("Tanned", "Yellow", "Pale", "Light", "Brown", "DarkBrown", "Black");
            var hairColorTypes = new Array();
            hairColorTypes.push("Auburn", "Black", "Blonde", "BlondeGolden", "Brown", "BrownDark", "PastelPink", "Platinum", "Red", "SilverGray");
            var hatColorOptions = new Array();
            hatColorOptions.push("Black", "Blue01", "Blue02", "Blue03", "Gray01", "Gray02", "Heather", "PastelBlue", "PastelGreen", "PastelOrange", "PastelRed", "PastelYellow", "Pink", "Red", "White");
            var clotheColorOptions = new Array();
            clotheColorOptions.push("Black", "Blue01", "Blue02", "Blue03", "Gray01", "Gray02", "Heather", "PastelBlue", "PastelGreen", "PastelOrange", "PastelRed", "PastelYellow", "Pink", "Red", "White");
            var rng = seed ? seedrandom_1.default(seed) : seedrandom_1.default();
            return "https://avataaars.io/?accessoriesType=" + accessoriesTypeOptions[Math.floor(rng() * accessoriesTypeOptions.length)] + "&avatarStyle=Circle&clotheColor=" + clotheColorOptions[Math.floor(rng() * clotheColorOptions.length)] + "&clotheType=" + clotheTypeOptions[Math.floor(rng() * clotheTypeOptions.length)] + "&eyeType=" + eyeTypeOptions[Math.floor(rng() * eyeTypeOptions.length)] + "&eyebrowType=" + eyebrowTypeOptions[Math.floor(rng() * eyebrowTypeOptions.length)] + "&facialHairColor=" + facialHairColorOptions[Math.floor(rng() * facialHairColorOptions.length)] + "&facialHairType=" + facialHairTypeOptions[Math.floor(rng() * facialHairTypeOptions.length)] + "&hairColor=" + hairColorTypes[Math.floor(rng() * hairColorTypes.length)] + "&hatColor=" + hatColorOptions[Math.floor(rng() * hatColorOptions.length)] + "&mouthType=" + mouthTypeOptions[Math.floor(rng() * mouthTypeOptions.length)] + "&skinColor=" + skinColorOptions[Math.floor(rng() * skinColorOptions.length)] + "&topType=" + topTypeOptions[Math.floor(rng() * topTypeOptions.length)];
        };
        return AvatarGenerator;
    }());
    AvatarGenerator_1 = dist.AvatarGenerator = AvatarGenerator;

    /* src\components\IntersectionObserver.svelte generated by Svelte v3.47.0 */
    const file$f = "src\\components\\IntersectionObserver.svelte";
    const get_default_slot_changes = dirty => ({ intersecting: dirty & /*intersecting*/ 1 });
    const get_default_slot_context = ctx => ({ intersecting: /*intersecting*/ ctx[0] });

    function create_fragment$f(ctx) {
    	let div;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[8].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[7], get_default_slot_context);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			if (default_slot) default_slot.l(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "svelte-1kuj9kb");
    			add_location(div, file$f, 44, 0, 1304);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			/*div_binding*/ ctx[9](div);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope, intersecting*/ 129)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[7],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[7])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[7], dirty, get_default_slot_changes),
    						get_default_slot_context
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			/*div_binding*/ ctx[9](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('IntersectionObserver', slots, ['default']);
    	let { once = false } = $$props;
    	let { top = 0 } = $$props;
    	let { bottom = 0 } = $$props;
    	let { left = 0 } = $$props;
    	let { right = 0 } = $$props;
    	let intersecting = false;
    	let container;

    	onMount(() => {
    		if (typeof IntersectionObserver !== "undefined") {
    			const rootMargin = `${bottom}px ${left}px ${top}px ${right}px`;

    			const observer = new IntersectionObserver(entries => {
    					$$invalidate(0, intersecting = entries[0].isIntersecting);

    					if (intersecting && once) {
    						observer.unobserve(container);
    					}
    				},
    			{ rootMargin });

    			observer.observe(container);
    			return () => observer.unobserve(container);
    		}
    	}); // function handler() {
    	// 	const bcr = container.getBoundingClientRect();
    	// 	intersecting = (
    	// 		(bcr.bottom + bottom) > 0 &&

    	const writable_props = ['once', 'top', 'bottom', 'left', 'right'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<IntersectionObserver> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			container = $$value;
    			$$invalidate(1, container);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('once' in $$props) $$invalidate(2, once = $$props.once);
    		if ('top' in $$props) $$invalidate(3, top = $$props.top);
    		if ('bottom' in $$props) $$invalidate(4, bottom = $$props.bottom);
    		if ('left' in $$props) $$invalidate(5, left = $$props.left);
    		if ('right' in $$props) $$invalidate(6, right = $$props.right);
    		if ('$$scope' in $$props) $$invalidate(7, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		once,
    		top,
    		bottom,
    		left,
    		right,
    		intersecting,
    		container
    	});

    	$$self.$inject_state = $$props => {
    		if ('once' in $$props) $$invalidate(2, once = $$props.once);
    		if ('top' in $$props) $$invalidate(3, top = $$props.top);
    		if ('bottom' in $$props) $$invalidate(4, bottom = $$props.bottom);
    		if ('left' in $$props) $$invalidate(5, left = $$props.left);
    		if ('right' in $$props) $$invalidate(6, right = $$props.right);
    		if ('intersecting' in $$props) $$invalidate(0, intersecting = $$props.intersecting);
    		if ('container' in $$props) $$invalidate(1, container = $$props.container);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		intersecting,
    		container,
    		once,
    		top,
    		bottom,
    		left,
    		right,
    		$$scope,
    		slots,
    		div_binding
    	];
    }

    class IntersectionObserver_1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$f, create_fragment$f, safe_not_equal, {
    			once: 2,
    			top: 3,
    			bottom: 4,
    			left: 5,
    			right: 6
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "IntersectionObserver_1",
    			options,
    			id: create_fragment$f.name
    		});
    	}

    	get once() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set once(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get top() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set top(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get bottom() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set bottom(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get left() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set left(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get right() {
    		throw new Error("<IntersectionObserver>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set right(value) {
    		throw new Error("<IntersectionObserver>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Image.svelte generated by Svelte v3.47.0 */
    const file$e = "src\\components\\Image.svelte";

    function create_fragment$e(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			img = claim_element(nodes, "IMG", {
    				src: true,
    				alt: true,
    				class: true,
    				width: true,
    				height: true,
    				loading: true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*src*/ ctx[0])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", /*alt*/ ctx[1]);
    			attr_dev(img, "class", "img-fluid rounded-circle");
    			attr_dev(img, "width", "132");
    			attr_dev(img, "height", "132");
    			attr_dev(img, "loading", "lazy");
    			toggle_class(img, "loaded", /*loaded*/ ctx[2]);
    			add_location(img, file$e, 13, 0, 227);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, img, anchor);
    			/*img_binding*/ ctx[4](img);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*src*/ 1 && !src_url_equal(img.src, img_src_value = /*src*/ ctx[0])) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*alt*/ 2) {
    				attr_dev(img, "alt", /*alt*/ ctx[1]);
    			}

    			if (dirty & /*loaded*/ 4) {
    				toggle_class(img, "loaded", /*loaded*/ ctx[2]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    			/*img_binding*/ ctx[4](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Image', slots, []);
    	let { src } = $$props;
    	let { alt } = $$props;
    	let loaded = false;
    	let thisImage;

    	onMount(() => {
    		$$invalidate(
    			3,
    			thisImage.onload = () => {
    				$$invalidate(2, loaded = true);
    			},
    			thisImage
    		);
    	});

    	const writable_props = ['src', 'alt'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Image> was created with unknown prop '${key}'`);
    	});

    	function img_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			thisImage = $$value;
    			$$invalidate(3, thisImage);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('src' in $$props) $$invalidate(0, src = $$props.src);
    		if ('alt' in $$props) $$invalidate(1, alt = $$props.alt);
    	};

    	$$self.$capture_state = () => ({ src, alt, onMount, loaded, thisImage });

    	$$self.$inject_state = $$props => {
    		if ('src' in $$props) $$invalidate(0, src = $$props.src);
    		if ('alt' in $$props) $$invalidate(1, alt = $$props.alt);
    		if ('loaded' in $$props) $$invalidate(2, loaded = $$props.loaded);
    		if ('thisImage' in $$props) $$invalidate(3, thisImage = $$props.thisImage);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [src, alt, loaded, thisImage, img_binding];
    }

    class Image extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$e, create_fragment$e, safe_not_equal, { src: 0, alt: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Image",
    			options,
    			id: create_fragment$e.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*src*/ ctx[0] === undefined && !('src' in props)) {
    			console.warn("<Image> was created without expected prop 'src'");
    		}

    		if (/*alt*/ ctx[1] === undefined && !('alt' in props)) {
    			console.warn("<Image> was created without expected prop 'alt'");
    		}
    	}

    	get src() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set src(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get alt() {
    		throw new Error("<Image>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set alt(value) {
    		throw new Error("<Image>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\ImageLoader.svelte generated by Svelte v3.47.0 */
    const file$d = "src\\components\\ImageLoader.svelte";

    // (20:2) {:else}
    function create_else_block$8(ctx) {
    	let div;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t = text("Loading...");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, role: true });
    			var div_nodes = children(div);
    			span = claim_element(div_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "Loading...");
    			span_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "sr-only");
    			add_location(span, file$d, 21, 6, 606);
    			attr_dev(div, "class", "spinner-border text-primary");
    			attr_dev(div, "role", "status");
    			add_location(div, file$d, 20, 4, 543);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, span);
    			append_hydration_dev(span, t);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$8.name,
    		type: "else",
    		source: "(20:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (18:2) {#if intersecting || nativeLoading}
    function create_if_block$9(ctx) {
    	let image;
    	let current;

    	image = new Image({
    			props: { alt: /*alt*/ ctx[1], src: /*src*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(image.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(image.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(image, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const image_changes = {};
    			if (dirty & /*alt*/ 2) image_changes.alt = /*alt*/ ctx[1];
    			if (dirty & /*src*/ 1) image_changes.src = /*src*/ ctx[0];
    			image.$set(image_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(image.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(image.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(image, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$9.name,
    		type: "if",
    		source: "(18:2) {#if intersecting || nativeLoading}",
    		ctx
    	});

    	return block;
    }

    // (17:0) <IntersectionObserver once={true} let:intersecting>
    function create_default_slot$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$9, create_else_block$8];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*intersecting*/ ctx[3] || /*nativeLoading*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(17:0) <IntersectionObserver once={true} let:intersecting>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let intersectionobserver;
    	let current;

    	intersectionobserver = new IntersectionObserver_1({
    			props: {
    				once: true,
    				$$slots: {
    					default: [
    						create_default_slot$1,
    						({ intersecting }) => ({ 3: intersecting }),
    						({ intersecting }) => intersecting ? 8 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(intersectionobserver.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(intersectionobserver.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(intersectionobserver, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const intersectionobserver_changes = {};

    			if (dirty & /*$$scope, alt, src, intersecting, nativeLoading*/ 31) {
    				intersectionobserver_changes.$$scope = { dirty, ctx };
    			}

    			intersectionobserver.$set(intersectionobserver_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(intersectionobserver.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(intersectionobserver.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(intersectionobserver, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ImageLoader', slots, []);
    	let { src } = $$props;
    	let { alt } = $$props;
    	let nativeLoading = false;

    	// Determine whether to bypass our intersecting check
    	onMount(() => {
    		if ("loading" in HTMLImageElement.prototype) {
    			$$invalidate(2, nativeLoading = true);
    		}
    	});

    	const writable_props = ['src', 'alt'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ImageLoader> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('src' in $$props) $$invalidate(0, src = $$props.src);
    		if ('alt' in $$props) $$invalidate(1, alt = $$props.alt);
    	};

    	$$self.$capture_state = () => ({
    		src,
    		alt,
    		onMount,
    		IntersectionObserver: IntersectionObserver_1,
    		Image,
    		nativeLoading
    	});

    	$$self.$inject_state = $$props => {
    		if ('src' in $$props) $$invalidate(0, src = $$props.src);
    		if ('alt' in $$props) $$invalidate(1, alt = $$props.alt);
    		if ('nativeLoading' in $$props) $$invalidate(2, nativeLoading = $$props.nativeLoading);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [src, alt, nativeLoading];
    }

    class ImageLoader extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$d, create_fragment$d, safe_not_equal, { src: 0, alt: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ImageLoader",
    			options,
    			id: create_fragment$d.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*src*/ ctx[0] === undefined && !('src' in props)) {
    			console.warn("<ImageLoader> was created without expected prop 'src'");
    		}

    		if (/*alt*/ ctx[1] === undefined && !('alt' in props)) {
    			console.warn("<ImageLoader> was created without expected prop 'alt'");
    		}
    	}

    	get src() {
    		throw new Error("<ImageLoader>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set src(value) {
    		throw new Error("<ImageLoader>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get alt() {
    		throw new Error("<ImageLoader>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set alt(value) {
    		throw new Error("<ImageLoader>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Register.svelte generated by Svelte v3.47.0 */

    const { console: console_1$7 } = globals;
    const file$c = "src\\pages\\Register.svelte";

    // (92:20) {:else}
    function create_else_block$7(ctx) {
    	let imageloader;
    	let current;

    	imageloader = new ImageLoader({
    			props: {
    				src: /*dp*/ ctx[0],
    				alt: "Não encontrado"
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(imageloader.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(imageloader.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(imageloader, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const imageloader_changes = {};
    			if (dirty & /*dp*/ 1) imageloader_changes.src = /*dp*/ ctx[0];
    			imageloader.$set(imageloader_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(imageloader.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(imageloader.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(imageloader, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$7.name,
    		type: "else",
    		source: "(92:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (88:20) {#if loading}
    function create_if_block$8(ctx) {
    	let div;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t = text("Carregando...");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, role: true });
    			var div_nodes = children(div);
    			span = claim_element(div_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "Carregando...");
    			span_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "sr-only");
    			add_location(span, file$c, 89, 24, 3211);
    			attr_dev(div, "class", "spinner-border text-primary");
    			attr_dev(div, "role", "status");
    			add_location(div, file$c, 88, 22, 3130);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, span);
    			append_hydration_dev(span, t);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$8.name,
    		type: "if",
    		source: "(88:20) {#if loading}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$c(ctx) {
    	let homenav;
    	let t0;
    	let div20;
    	let main;
    	let div19;
    	let div18;
    	let div17;
    	let div16;
    	let div0;
    	let h1;
    	let t1;
    	let t2;
    	let p;
    	let t3;
    	let t4;
    	let div15;
    	let div14;
    	let div13;
    	let div1;
    	let current_block_type_index;
    	let if_block;
    	let t5;
    	let form;
    	let div2;
    	let label0;
    	let t6;
    	let t7;
    	let input0;
    	let t8;
    	let div3;
    	let label1;
    	let t9;
    	let t10;
    	let input1;
    	let t11;
    	let div4;
    	let label2;
    	let t12;
    	let t13;
    	let input2;
    	let t14;
    	let div5;
    	let label3;
    	let t15;
    	let t16;
    	let input3;
    	let t17;
    	let div6;
    	let label4;
    	let t18;
    	let t19;
    	let input4;
    	let t20;
    	let div7;
    	let label5;
    	let t21;
    	let t22;
    	let input5;
    	let t23;
    	let div8;
    	let label6;
    	let t24;
    	let t25;
    	let input6;
    	let t26;
    	let div9;
    	let label7;
    	let t27;
    	let t28;
    	let input7;
    	let t29;
    	let div10;
    	let label8;
    	let t30;
    	let t31;
    	let input8;
    	let t32;
    	let div11;
    	let label9;
    	let t33;
    	let t34;
    	let input9;
    	let t35;
    	let div12;
    	let button;
    	let t36;
    	let t37;
    	let alert;
    	let t38;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;
    	homenav = new HomeNav({ $$inline: true });
    	const if_block_creators = [create_if_block$8, create_else_block$7];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[2]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	alert = new Alert({
    			props: {
    				mssg: /*mssg*/ ctx[4],
    				status: /*status*/ ctx[3]
    			},
    			$$inline: true
    		});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(homenav.$$.fragment);
    			t0 = space();
    			div20 = element("div");
    			main = element("main");
    			div19 = element("div");
    			div18 = element("div");
    			div17 = element("div");
    			div16 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t1 = text("Vamos começar");
    			t2 = space();
    			p = element("p");
    			t3 = text("Esse é o início de uma nova experiência com seus clientes.");
    			t4 = space();
    			div15 = element("div");
    			div14 = element("div");
    			div13 = element("div");
    			div1 = element("div");
    			if_block.c();
    			t5 = space();
    			form = element("form");
    			div2 = element("div");
    			label0 = element("label");
    			t6 = text("Nome do Usuário");
    			t7 = space();
    			input0 = element("input");
    			t8 = space();
    			div3 = element("div");
    			label1 = element("label");
    			t9 = text("Usuário do Instagram");
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			div4 = element("div");
    			label2 = element("label");
    			t12 = text("Cor do Cabeçalho");
    			t13 = space();
    			input2 = element("input");
    			t14 = space();
    			div5 = element("div");
    			label3 = element("label");
    			t15 = text("Cor do Botão");
    			t16 = space();
    			input3 = element("input");
    			t17 = space();
    			div6 = element("div");
    			label4 = element("label");
    			t18 = text("Cor do Botão Secundário");
    			t19 = space();
    			input4 = element("input");
    			t20 = space();
    			div7 = element("div");
    			label5 = element("label");
    			t21 = text("Cor do Botão de Alerta");
    			t22 = space();
    			input5 = element("input");
    			t23 = space();
    			div8 = element("div");
    			label6 = element("label");
    			t24 = text("E-mail para recuperação");
    			t25 = space();
    			input6 = element("input");
    			t26 = space();
    			div9 = element("div");
    			label7 = element("label");
    			t27 = text("Facebook");
    			t28 = space();
    			input7 = element("input");
    			t29 = space();
    			div10 = element("div");
    			label8 = element("label");
    			t30 = text("Twitter");
    			t31 = space();
    			input8 = element("input");
    			t32 = space();
    			div11 = element("div");
    			label9 = element("label");
    			t33 = text("Senha");
    			t34 = space();
    			input9 = element("input");
    			t35 = space();
    			div12 = element("div");
    			button = element("button");
    			t36 = text("Cadastre-se");
    			t37 = space();
    			create_component(alert.$$.fragment);
    			t38 = space();
    			create_component(footer.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			claim_component(homenav.$$.fragment, nodes);
    			t0 = claim_space(nodes);
    			div20 = claim_element(nodes, "DIV", { class: true });
    			var div20_nodes = children(div20);
    			main = claim_element(div20_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div19 = claim_element(main_nodes, "DIV", { class: true });
    			var div19_nodes = children(div19);
    			div18 = claim_element(div19_nodes, "DIV", { class: true });
    			var div18_nodes = children(div18);
    			div17 = claim_element(div18_nodes, "DIV", { class: true });
    			var div17_nodes = children(div17);
    			div16 = claim_element(div17_nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			div0 = claim_element(div16_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t1 = claim_text(h1_nodes, "Vamos começar");
    			h1_nodes.forEach(detach_dev);
    			t2 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, "Esse é o início de uma nova experiência com seus clientes.");
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t4 = claim_space(div16_nodes);
    			div15 = claim_element(div16_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			div14 = claim_element(div15_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div1 = claim_element(div13_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div13_nodes);
    			form = claim_element(div13_nodes, "FORM", {});
    			var form_nodes = children(form);
    			div2 = claim_element(form_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			label0 = claim_element(div2_nodes, "LABEL", { for: true });
    			var label0_nodes = children(label0);
    			t6 = claim_text(label0_nodes, "Nome do Usuário");
    			label0_nodes.forEach(detach_dev);
    			t7 = claim_space(div2_nodes);

    			input0 = claim_element(div2_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div2_nodes.forEach(detach_dev);
    			t8 = claim_space(form_nodes);
    			div3 = claim_element(form_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			label1 = claim_element(div3_nodes, "LABEL", { for: true });
    			var label1_nodes = children(label1);
    			t9 = claim_text(label1_nodes, "Usuário do Instagram");
    			label1_nodes.forEach(detach_dev);
    			t10 = claim_space(div3_nodes);

    			input1 = claim_element(div3_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div3_nodes.forEach(detach_dev);
    			t11 = claim_space(form_nodes);
    			div4 = claim_element(form_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			label2 = claim_element(div4_nodes, "LABEL", { for: true });
    			var label2_nodes = children(label2);
    			t12 = claim_text(label2_nodes, "Cor do Cabeçalho");
    			label2_nodes.forEach(detach_dev);
    			t13 = claim_space(div4_nodes);

    			input2 = claim_element(div4_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div4_nodes.forEach(detach_dev);
    			t14 = claim_space(form_nodes);
    			div5 = claim_element(form_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			label3 = claim_element(div5_nodes, "LABEL", { for: true });
    			var label3_nodes = children(label3);
    			t15 = claim_text(label3_nodes, "Cor do Botão");
    			label3_nodes.forEach(detach_dev);
    			t16 = claim_space(div5_nodes);

    			input3 = claim_element(div5_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div5_nodes.forEach(detach_dev);
    			t17 = claim_space(form_nodes);
    			div6 = claim_element(form_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			label4 = claim_element(div6_nodes, "LABEL", { for: true });
    			var label4_nodes = children(label4);
    			t18 = claim_text(label4_nodes, "Cor do Botão Secundário");
    			label4_nodes.forEach(detach_dev);
    			t19 = claim_space(div6_nodes);

    			input4 = claim_element(div6_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div6_nodes.forEach(detach_dev);
    			t20 = claim_space(form_nodes);
    			div7 = claim_element(form_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			label5 = claim_element(div7_nodes, "LABEL", { for: true });
    			var label5_nodes = children(label5);
    			t21 = claim_text(label5_nodes, "Cor do Botão de Alerta");
    			label5_nodes.forEach(detach_dev);
    			t22 = claim_space(div7_nodes);

    			input5 = claim_element(div7_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div7_nodes.forEach(detach_dev);
    			t23 = claim_space(form_nodes);
    			div8 = claim_element(form_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			label6 = claim_element(div8_nodes, "LABEL", { for: true });
    			var label6_nodes = children(label6);
    			t24 = claim_text(label6_nodes, "E-mail para recuperação");
    			label6_nodes.forEach(detach_dev);
    			t25 = claim_space(div8_nodes);

    			input6 = claim_element(div8_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div8_nodes.forEach(detach_dev);
    			t26 = claim_space(form_nodes);
    			div9 = claim_element(form_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			label7 = claim_element(div9_nodes, "LABEL", { for: true });
    			var label7_nodes = children(label7);
    			t27 = claim_text(label7_nodes, "Facebook");
    			label7_nodes.forEach(detach_dev);
    			t28 = claim_space(div9_nodes);

    			input7 = claim_element(div9_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div9_nodes.forEach(detach_dev);
    			t29 = claim_space(form_nodes);
    			div10 = claim_element(form_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			label8 = claim_element(div10_nodes, "LABEL", { for: true });
    			var label8_nodes = children(label8);
    			t30 = claim_text(label8_nodes, "Twitter");
    			label8_nodes.forEach(detach_dev);
    			t31 = claim_space(div10_nodes);

    			input8 = claim_element(div10_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div10_nodes.forEach(detach_dev);
    			t32 = claim_space(form_nodes);
    			div11 = claim_element(form_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			label9 = claim_element(div11_nodes, "LABEL", { for: true });
    			var label9_nodes = children(label9);
    			t33 = claim_text(label9_nodes, "Senha");
    			label9_nodes.forEach(detach_dev);
    			t34 = claim_space(div11_nodes);

    			input9 = claim_element(div11_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div11_nodes.forEach(detach_dev);
    			t35 = claim_space(form_nodes);
    			div12 = claim_element(form_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			button = claim_element(div12_nodes, "BUTTON", { type: true, class: true });
    			var button_nodes = children(button);
    			t36 = claim_text(button_nodes, "Cadastre-se");
    			button_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			div16_nodes.forEach(detach_dev);
    			div17_nodes.forEach(detach_dev);
    			div18_nodes.forEach(detach_dev);
    			div19_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			div20_nodes.forEach(detach_dev);
    			t37 = claim_space(nodes);
    			claim_component(alert.$$.fragment, nodes);
    			t38 = claim_space(nodes);
    			claim_component(footer.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "h2");
    			add_location(h1, file$c, 77, 14, 2734);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$c, 78, 14, 2783);
    			attr_dev(div0, "class", "text-center mt-4");
    			add_location(div0, file$c, 76, 12, 2688);
    			attr_dev(div1, "class", "text-center");
    			add_location(div1, file$c, 86, 18, 3046);
    			attr_dev(label0, "for", "");
    			add_location(label0, file$c, 97, 22, 3551);
    			attr_dev(input0, "class", "form-control form-control-lg");
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "placeholder", "nome");
    			add_location(input0, file$c, 98, 22, 3612);
    			attr_dev(div2, "class", "form-group");
    			add_location(div2, file$c, 96, 20, 3503);
    			attr_dev(label1, "for", "");
    			add_location(label1, file$c, 107, 22, 3967);
    			attr_dev(input1, "class", "form-control form-control-lg");
    			attr_dev(input1, "type", "text");
    			input1.required = true;
    			attr_dev(input1, "placeholder", "usuario");
    			add_location(input1, file$c, 108, 22, 4033);
    			attr_dev(div3, "class", "form-group");
    			add_location(div3, file$c, 106, 20, 3919);
    			attr_dev(label2, "for", "");
    			add_location(label2, file$c, 118, 22, 4418);
    			attr_dev(input2, "class", "form-control form-control-lg");
    			attr_dev(input2, "type", "color");
    			input2.required = true;
    			attr_dev(input2, "placeholder", "cor");
    			add_location(input2, file$c, 119, 22, 4480);
    			attr_dev(div4, "class", "form-group");
    			add_location(div4, file$c, 117, 20, 4370);
    			attr_dev(label3, "for", "");
    			add_location(label3, file$c, 128, 22, 4849);
    			attr_dev(input3, "class", "form-control form-control-lg");
    			attr_dev(input3, "type", "color");
    			input3.required = true;
    			attr_dev(input3, "placeholder", "cor");
    			add_location(input3, file$c, 129, 22, 4907);
    			attr_dev(div5, "class", "form-group");
    			add_location(div5, file$c, 127, 20, 4801);
    			attr_dev(label4, "for", "");
    			add_location(label4, file$c, 138, 22, 5277);
    			attr_dev(input4, "class", "form-control form-control-lg");
    			attr_dev(input4, "type", "color");
    			input4.required = true;
    			attr_dev(input4, "placeholder", "cor");
    			add_location(input4, file$c, 139, 22, 5346);
    			attr_dev(div6, "class", "form-group");
    			add_location(div6, file$c, 137, 20, 5229);
    			attr_dev(label5, "for", "");
    			add_location(label5, file$c, 148, 22, 5718);
    			attr_dev(input5, "class", "form-control form-control-lg");
    			attr_dev(input5, "type", "color");
    			input5.required = true;
    			attr_dev(input5, "placeholder", "cor");
    			add_location(input5, file$c, 149, 22, 5786);
    			attr_dev(div7, "class", "form-group");
    			add_location(div7, file$c, 147, 20, 5670);
    			attr_dev(label6, "for", "");
    			add_location(label6, file$c, 159, 22, 6178);
    			attr_dev(input6, "class", "form-control form-control-lg");
    			attr_dev(input6, "type", "text");
    			input6.required = true;
    			attr_dev(input6, "placeholder", "usuario@gmail.com");
    			add_location(input6, file$c, 160, 22, 6247);
    			attr_dev(div8, "class", "form-group");
    			add_location(div8, file$c, 158, 20, 6130);
    			attr_dev(label7, "for", "");
    			add_location(label7, file$c, 169, 22, 6616);
    			attr_dev(input7, "class", "form-control form-control-lg");
    			attr_dev(input7, "type", "text");
    			attr_dev(input7, "placeholder", "usuario");
    			add_location(input7, file$c, 170, 22, 6670);
    			attr_dev(div9, "class", "form-group");
    			add_location(div9, file$c, 168, 20, 6568);
    			attr_dev(label8, "for", "");
    			add_location(label8, file$c, 178, 22, 6998);
    			attr_dev(input8, "class", "form-control form-control-lg");
    			attr_dev(input8, "type", "text");
    			attr_dev(input8, "placeholder", "usuario");
    			add_location(input8, file$c, 179, 22, 7051);
    			attr_dev(div10, "class", "form-group");
    			add_location(div10, file$c, 177, 20, 6950);
    			attr_dev(label9, "for", "");
    			add_location(label9, file$c, 187, 22, 7378);
    			attr_dev(input9, "class", "form-control form-control-lg");
    			attr_dev(input9, "type", "password");
    			input9.required = true;
    			attr_dev(input9, "placeholder", "Digite uma senha");
    			add_location(input9, file$c, 188, 22, 7429);
    			attr_dev(div11, "class", "form-group");
    			add_location(div11, file$c, 186, 20, 7330);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "btn btn-lg btn-primary");
    			add_location(button, file$c, 197, 22, 7810);
    			attr_dev(div12, "class", "text-center mt-3");
    			add_location(div12, file$c, 196, 20, 7756);
    			add_location(form, file$c, 95, 18, 3454);
    			attr_dev(div13, "class", "m-sm-4");
    			add_location(div13, file$c, 85, 16, 3006);
    			attr_dev(div14, "class", "card-body");
    			add_location(div14, file$c, 84, 14, 2965);
    			attr_dev(div15, "class", "card");
    			add_location(div15, file$c, 83, 12, 2931);
    			attr_dev(div16, "class", "align-middle");
    			add_location(div16, file$c, 75, 10, 2648);
    			attr_dev(div17, "class", "col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100");
    			add_location(div17, file$c, 74, 8, 2573);
    			attr_dev(div18, "class", "row h-100");
    			add_location(div18, file$c, 73, 6, 2540);
    			attr_dev(div19, "class", "container d-flex flex-column");
    			add_location(div19, file$c, 72, 4, 2490);
    			attr_dev(main, "class", "content d-flex p-0");
    			add_location(main, file$c, 71, 2, 2451);
    			attr_dev(div20, "class", "main d-flex justify-content-center w-100");
    			add_location(div20, file$c, 70, 0, 2393);
    		},
    		m: function mount(target, anchor) {
    			mount_component(homenav, target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div20, anchor);
    			append_hydration_dev(div20, main);
    			append_hydration_dev(main, div19);
    			append_hydration_dev(div19, div18);
    			append_hydration_dev(div18, div17);
    			append_hydration_dev(div17, div16);
    			append_hydration_dev(div16, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t1);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(div16, t4);
    			append_hydration_dev(div16, div15);
    			append_hydration_dev(div15, div14);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div1);
    			if_blocks[current_block_type_index].m(div1, null);
    			append_hydration_dev(div13, t5);
    			append_hydration_dev(div13, form);
    			append_hydration_dev(form, div2);
    			append_hydration_dev(div2, label0);
    			append_hydration_dev(label0, t6);
    			append_hydration_dev(div2, t7);
    			append_hydration_dev(div2, input0);
    			set_input_value(input0, /*user*/ ctx[1].name);
    			append_hydration_dev(form, t8);
    			append_hydration_dev(form, div3);
    			append_hydration_dev(div3, label1);
    			append_hydration_dev(label1, t9);
    			append_hydration_dev(div3, t10);
    			append_hydration_dev(div3, input1);
    			set_input_value(input1, /*user*/ ctx[1].instagram);
    			append_hydration_dev(form, t11);
    			append_hydration_dev(form, div4);
    			append_hydration_dev(div4, label2);
    			append_hydration_dev(label2, t12);
    			append_hydration_dev(div4, t13);
    			append_hydration_dev(div4, input2);
    			set_input_value(input2, /*user*/ ctx[1].style.header_color);
    			append_hydration_dev(form, t14);
    			append_hydration_dev(form, div5);
    			append_hydration_dev(div5, label3);
    			append_hydration_dev(label3, t15);
    			append_hydration_dev(div5, t16);
    			append_hydration_dev(div5, input3);
    			set_input_value(input3, /*user*/ ctx[1].style.primary_color);
    			append_hydration_dev(form, t17);
    			append_hydration_dev(form, div6);
    			append_hydration_dev(div6, label4);
    			append_hydration_dev(label4, t18);
    			append_hydration_dev(div6, t19);
    			append_hydration_dev(div6, input4);
    			set_input_value(input4, /*user*/ ctx[1].style.secondary_color);
    			append_hydration_dev(form, t20);
    			append_hydration_dev(form, div7);
    			append_hydration_dev(div7, label5);
    			append_hydration_dev(label5, t21);
    			append_hydration_dev(div7, t22);
    			append_hydration_dev(div7, input5);
    			set_input_value(input5, /*user*/ ctx[1].style.warning_color);
    			append_hydration_dev(form, t23);
    			append_hydration_dev(form, div8);
    			append_hydration_dev(div8, label6);
    			append_hydration_dev(label6, t24);
    			append_hydration_dev(div8, t25);
    			append_hydration_dev(div8, input6);
    			set_input_value(input6, /*user*/ ctx[1].email);
    			append_hydration_dev(form, t26);
    			append_hydration_dev(form, div9);
    			append_hydration_dev(div9, label7);
    			append_hydration_dev(label7, t27);
    			append_hydration_dev(div9, t28);
    			append_hydration_dev(div9, input7);
    			set_input_value(input7, /*user*/ ctx[1].facebook);
    			append_hydration_dev(form, t29);
    			append_hydration_dev(form, div10);
    			append_hydration_dev(div10, label8);
    			append_hydration_dev(label8, t30);
    			append_hydration_dev(div10, t31);
    			append_hydration_dev(div10, input8);
    			set_input_value(input8, /*user*/ ctx[1].twitter);
    			append_hydration_dev(form, t32);
    			append_hydration_dev(form, div11);
    			append_hydration_dev(div11, label9);
    			append_hydration_dev(label9, t33);
    			append_hydration_dev(div11, t34);
    			append_hydration_dev(div11, input9);
    			set_input_value(input9, /*user*/ ctx[1].password);
    			append_hydration_dev(form, t35);
    			append_hydration_dev(form, div12);
    			append_hydration_dev(div12, button);
    			append_hydration_dev(button, t36);
    			insert_hydration_dev(target, t37, anchor);
    			mount_component(alert, target, anchor);
    			insert_hydration_dev(target, t38, anchor);
    			mount_component(footer, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[6]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[7]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[8]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[9]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[10]),
    					listen_dev(input5, "input", /*input5_input_handler*/ ctx[11]),
    					listen_dev(input6, "input", /*input6_input_handler*/ ctx[12]),
    					listen_dev(input7, "input", /*input7_input_handler*/ ctx[13]),
    					listen_dev(input8, "input", /*input8_input_handler*/ ctx[14]),
    					listen_dev(input9, "input", /*input9_input_handler*/ ctx[15]),
    					listen_dev(form, "submit", /*register*/ ctx[5], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div1, null);
    			}

    			if (dirty & /*user*/ 2 && input0.value !== /*user*/ ctx[1].name) {
    				set_input_value(input0, /*user*/ ctx[1].name);
    			}

    			if (dirty & /*user*/ 2 && input1.value !== /*user*/ ctx[1].instagram) {
    				set_input_value(input1, /*user*/ ctx[1].instagram);
    			}

    			if (dirty & /*user*/ 2) {
    				set_input_value(input2, /*user*/ ctx[1].style.header_color);
    			}

    			if (dirty & /*user*/ 2) {
    				set_input_value(input3, /*user*/ ctx[1].style.primary_color);
    			}

    			if (dirty & /*user*/ 2) {
    				set_input_value(input4, /*user*/ ctx[1].style.secondary_color);
    			}

    			if (dirty & /*user*/ 2) {
    				set_input_value(input5, /*user*/ ctx[1].style.warning_color);
    			}

    			if (dirty & /*user*/ 2 && input6.value !== /*user*/ ctx[1].email) {
    				set_input_value(input6, /*user*/ ctx[1].email);
    			}

    			if (dirty & /*user*/ 2 && input7.value !== /*user*/ ctx[1].facebook) {
    				set_input_value(input7, /*user*/ ctx[1].facebook);
    			}

    			if (dirty & /*user*/ 2 && input8.value !== /*user*/ ctx[1].twitter) {
    				set_input_value(input8, /*user*/ ctx[1].twitter);
    			}

    			if (dirty & /*user*/ 2 && input9.value !== /*user*/ ctx[1].password) {
    				set_input_value(input9, /*user*/ ctx[1].password);
    			}

    			const alert_changes = {};
    			if (dirty & /*mssg*/ 16) alert_changes.mssg = /*mssg*/ ctx[4];
    			if (dirty & /*status*/ 8) alert_changes.status = /*status*/ ctx[3];
    			alert.$set(alert_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(homenav.$$.fragment, local);
    			transition_in(if_block);
    			transition_in(alert.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(homenav.$$.fragment, local);
    			transition_out(if_block);
    			transition_out(alert.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(homenav, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div20);
    			if_blocks[current_block_type_index].d();
    			if (detaching) detach_dev(t37);
    			destroy_component(alert, detaching);
    			if (detaching) detach_dev(t38);
    			destroy_component(footer, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Register', slots, []);
    	const generator = new AvatarGenerator_1();
    	let dp = "https://st3.depositphotos.com/4111759/13425/v/600/depositphotos_134255710-stock-illustration-avatar-vector-male-profile-gray.jpg";

    	let user = {
    		password: "",
    		instagram: "",
    		facebook: "",
    		style: {
    			primary_color: "blue",
    			secondary_color: "green",
    			warning_color: "red",
    			header_color: "#eff2f6"
    		},
    		twitter: "",
    		email: "",
    		dp: ""
    	};

    	let loading = false;

    	function getPhoto(a) {
    		$$invalidate(2, loading = true);
    		$$invalidate(0, dp = generator.generateRandomAvatar());
    		$$invalidate(1, user.dp = dp, user);
    		$$invalidate(2, loading = false);
    	}

    	let status = -1;
    	let mssg = "";

    	const register = e => {
    		console.log(JSON.stringify(user));
    		e.preventDefault();

    		fetch("/api/user/register", {
    			method: "POST", // *GET, POST, PUT, DELETE, etc.
    			mode: "cors", // no-cors, *cors, same-origin
    			cache: "no-cache", // *default, no-cache, reload, force-cache, only-if-cached
    			credentials: "same-origin", // include, *same-origin, omit
    			headers: { "Content-Type": "application/json" }, // 'Content-Type': 'application/x-www-form-urlencoded',
    			redirect: "follow", // manual, *follow, error
    			referrerPolicy: "no-referrer", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
    			body: JSON.stringify(user)
    		}).then(function (response) {
    			return response.json();
    		}).then(function (data) {
    			$$invalidate(4, mssg = "Registrado com Sucesso");
    			$$invalidate(3, status = 0);

    			userStore.update(currUser => {
    				return { token: data.token, user: data.user };
    			});

    			document.location.href = "/dashboard";
    		}).catch(error => {
    			console.error("Error:", error);
    			$$invalidate(3, status = 1);
    			$$invalidate(4, mssg = "Tivemos algum problema, por favor tente novamente");
    		});
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$7.warn(`<Register> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		user.name = this.value;
    		$$invalidate(1, user);
    	}

    	function input1_input_handler() {
    		user.instagram = this.value;
    		$$invalidate(1, user);
    	}

    	function input2_input_handler() {
    		user.style.header_color = this.value;
    		$$invalidate(1, user);
    	}

    	function input3_input_handler() {
    		user.style.primary_color = this.value;
    		$$invalidate(1, user);
    	}

    	function input4_input_handler() {
    		user.style.secondary_color = this.value;
    		$$invalidate(1, user);
    	}

    	function input5_input_handler() {
    		user.style.warning_color = this.value;
    		$$invalidate(1, user);
    	}

    	function input6_input_handler() {
    		user.email = this.value;
    		$$invalidate(1, user);
    	}

    	function input7_input_handler() {
    		user.facebook = this.value;
    		$$invalidate(1, user);
    	}

    	function input8_input_handler() {
    		user.twitter = this.value;
    		$$invalidate(1, user);
    	}

    	function input9_input_handler() {
    		user.password = this.value;
    		$$invalidate(1, user);
    	}

    	$$self.$capture_state = () => ({
    		Alert,
    		axios,
    		HomeNav,
    		Footer,
    		userStore,
    		AvatarGenerator: AvatarGenerator_1,
    		ImageLoader,
    		generator,
    		dp,
    		user,
    		loading,
    		getPhoto,
    		status,
    		mssg,
    		register
    	});

    	$$self.$inject_state = $$props => {
    		if ('dp' in $$props) $$invalidate(0, dp = $$props.dp);
    		if ('user' in $$props) $$invalidate(1, user = $$props.user);
    		if ('loading' in $$props) $$invalidate(2, loading = $$props.loading);
    		if ('status' in $$props) $$invalidate(3, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(4, mssg = $$props.mssg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		dp,
    		user,
    		loading,
    		status,
    		mssg,
    		register,
    		input0_input_handler,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_input_handler,
    		input6_input_handler,
    		input7_input_handler,
    		input8_input_handler,
    		input9_input_handler
    	];
    }

    class Register extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$c, create_fragment$c, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Register",
    			options,
    			id: create_fragment$c.name
    		});
    	}
    }

    /* src\pages\ResetPassword.svelte generated by Svelte v3.47.0 */
    const file$b = "src\\pages\\ResetPassword.svelte";

    // (53:20) {:else}
    function create_else_block$6(ctx) {
    	let div0;
    	let label0;
    	let t0;
    	let t1;
    	let input0;
    	let t2;
    	let div1;
    	let label1;
    	let t3;
    	let t4;
    	let input1;
    	let t5;
    	let div2;
    	let button;
    	let t6;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			label0 = element("label");
    			t0 = text("Enter OTP");
    			t1 = space();
    			input0 = element("input");
    			t2 = space();
    			div1 = element("div");
    			label1 = element("label");
    			t3 = text("Enter new password");
    			t4 = space();
    			input1 = element("input");
    			t5 = space();
    			div2 = element("div");
    			button = element("button");
    			t6 = text("Change Password");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			label0 = claim_element(div0_nodes, "LABEL", { for: true });
    			var label0_nodes = children(label0);
    			t0 = claim_text(label0_nodes, "Enter OTP");
    			label0_nodes.forEach(detach_dev);
    			t1 = claim_space(div0_nodes);

    			input0 = claim_element(div0_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			label1 = claim_element(div1_nodes, "LABEL", { for: true });
    			var label1_nodes = children(label1);
    			t3 = claim_text(label1_nodes, "Enter new password");
    			label1_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);

    			input1 = claim_element(div1_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(nodes);
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			button = claim_element(div2_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t6 = claim_text(button_nodes, "Change Password");
    			button_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(label0, "for", "");
    			add_location(label0, file$b, 54, 24, 1921);
    			attr_dev(input0, "class", "form-control form-control-lg");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "Enter Otp");
    			add_location(input0, file$b, 55, 24, 1978);
    			attr_dev(div0, "class", "form-group");
    			add_location(div0, file$b, 53, 22, 1871);
    			attr_dev(label1, "for", "");
    			add_location(label1, file$b, 63, 24, 2314);
    			attr_dev(input1, "class", "form-control form-control-lg");
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "placeholder", "..........");
    			add_location(input1, file$b, 64, 24, 2380);
    			attr_dev(div1, "class", "form-group");
    			add_location(div1, file$b, 62, 22, 2264);
    			attr_dev(button, "class", "btn btn-lg btn-primary");
    			add_location(button, file$b, 72, 24, 2732);
    			attr_dev(div2, "class", "text-center mt-3");
    			add_location(div2, file$b, 71, 22, 2676);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			append_hydration_dev(div0, label0);
    			append_hydration_dev(label0, t0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, input0);
    			set_input_value(input0, /*otp*/ ctx[4]);
    			insert_hydration_dev(target, t2, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, label1);
    			append_hydration_dev(label1, t3);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div1, input1);
    			set_input_value(input1, /*password*/ ctx[5]);
    			insert_hydration_dev(target, t5, anchor);
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, button);
    			append_hydration_dev(button, t6);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[9])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*otp*/ 16 && input0.value !== /*otp*/ ctx[4]) {
    				set_input_value(input0, /*otp*/ ctx[4]);
    			}

    			if (dirty & /*password*/ 32 && input1.value !== /*password*/ ctx[5]) {
    				set_input_value(input1, /*password*/ ctx[5]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t5);
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$6.name,
    		type: "else",
    		source: "(53:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (38:20) {#if display}
    function create_if_block$7(ctx) {
    	let div0;
    	let label;
    	let t0;
    	let t1;
    	let input;
    	let t2;
    	let div1;
    	let button;
    	let t3;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			label = element("label");
    			t0 = text("Email");
    			t1 = space();
    			input = element("input");
    			t2 = space();
    			div1 = element("div");
    			button = element("button");
    			t3 = text("Send email");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div0 = claim_element(nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			label = claim_element(div0_nodes, "LABEL", { for: true });
    			var label_nodes = children(label);
    			t0 = claim_text(label_nodes, "Email");
    			label_nodes.forEach(detach_dev);
    			t1 = claim_space(div0_nodes);

    			input = claim_element(div0_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(nodes);
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			button = claim_element(div1_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t3 = claim_text(button_nodes, "Send email");
    			button_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(label, "for", "");
    			add_location(label, file$b, 39, 24, 1271);
    			attr_dev(input, "class", "form-control form-control-lg");
    			attr_dev(input, "type", "email");
    			attr_dev(input, "placeholder", "Enter your email");
    			add_location(input, file$b, 40, 24, 1324);
    			attr_dev(div0, "class", "form-group");
    			add_location(div0, file$b, 38, 22, 1221);
    			attr_dev(button, "class", "btn btn-lg btn-primary");
    			add_location(button, file$b, 48, 24, 1676);
    			attr_dev(div1, "class", "text-center mt-3");
    			add_location(div1, file$b, 47, 22, 1620);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div0, anchor);
    			append_hydration_dev(div0, label);
    			append_hydration_dev(label, t0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, input);
    			set_input_value(input, /*email*/ ctx[3]);
    			insert_hydration_dev(target, t2, anchor);
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, button);
    			append_hydration_dev(button, t3);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", /*input_input_handler*/ ctx[7]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*email*/ 8 && input.value !== /*email*/ ctx[3]) {
    				set_input_value(input, /*email*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$7.name,
    		type: "if",
    		source: "(38:20) {#if display}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let div8;
    	let main;
    	let div7;
    	let div6;
    	let div5;
    	let div4;
    	let div0;
    	let h1;
    	let t0;
    	let t1;
    	let p;
    	let t2;
    	let t3;
    	let div3;
    	let div2;
    	let div1;
    	let form;
    	let t4;
    	let alert;
    	let current;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*display*/ ctx[0]) return create_if_block$7;
    		return create_else_block$6;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	alert = new Alert({
    			props: {
    				status: /*status*/ ctx[1],
    				mssg: /*mssg*/ ctx[2]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div8 = element("div");
    			main = element("main");
    			div7 = element("div");
    			div6 = element("div");
    			div5 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("Reset password");
    			t1 = space();
    			p = element("p");
    			t2 = text("Enter your email to reset your password.");
    			t3 = space();
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			form = element("form");
    			if_block.c();
    			t4 = space();
    			create_component(alert.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div8 = claim_element(nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			main = claim_element(div8_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div7 = claim_element(main_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div0 = claim_element(div4_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Reset password");
    			h1_nodes.forEach(detach_dev);
    			t1 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t2 = claim_text(p_nodes, "Enter your email to reset your password.");
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t3 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			form = claim_element(div1_nodes, "FORM", {});
    			var form_nodes = children(form);
    			if_block.l(form_nodes);
    			form_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			t4 = claim_space(nodes);
    			claim_component(alert.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "h2");
    			add_location(h1, file$b, 29, 14, 877);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$b, 30, 14, 927);
    			attr_dev(div0, "class", "text-center mt-4");
    			add_location(div0, file$b, 28, 12, 831);
    			add_location(form, file$b, 36, 18, 1138);
    			attr_dev(div1, "class", "m-sm-4");
    			add_location(div1, file$b, 35, 16, 1098);
    			attr_dev(div2, "class", "card-body");
    			add_location(div2, file$b, 34, 14, 1057);
    			attr_dev(div3, "class", "card");
    			add_location(div3, file$b, 33, 12, 1023);
    			attr_dev(div4, "class", "d-table-cell align-middle");
    			add_location(div4, file$b, 27, 10, 778);
    			attr_dev(div5, "class", "col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100");
    			add_location(div5, file$b, 26, 8, 703);
    			attr_dev(div6, "class", "row h-100");
    			add_location(div6, file$b, 25, 6, 670);
    			attr_dev(div7, "class", "container d-flex flex-column");
    			add_location(div7, file$b, 24, 4, 620);
    			attr_dev(main, "class", "content d-flex p-0");
    			add_location(main, file$b, 23, 2, 581);
    			attr_dev(div8, "class", "main d-flex justify-content-center w-100");
    			add_location(div8, file$b, 22, 0, 523);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div8, anchor);
    			append_hydration_dev(div8, main);
    			append_hydration_dev(main, div7);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t2);
    			append_hydration_dev(div4, t3);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, form);
    			if_block.m(form, null);
    			insert_hydration_dev(target, t4, anchor);
    			mount_component(alert, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(form, "submit", /*rpass*/ ctx[6], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(form, null);
    				}
    			}

    			const alert_changes = {};
    			if (dirty & /*status*/ 2) alert_changes.status = /*status*/ ctx[1];
    			if (dirty & /*mssg*/ 4) alert_changes.mssg = /*mssg*/ ctx[2];
    			alert.$set(alert_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(alert.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(alert.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div8);
    			if_block.d();
    			if (detaching) detach_dev(t4);
    			destroy_component(alert, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ResetPassword', slots, []);
    	let display = true;
    	let status = -1;
    	let mssg = "";
    	let email = "";
    	let otp = "";
    	let password = "";

    	const rpass = async e => {
    		e.preventDefault();
    		let yes;
    		if (display) yes = await reset(email); else yes = await check(email, otp, password);
    		$$invalidate(2, mssg = yes.mssg);
    		$$invalidate(1, status = yes.status);

    		if (yes.status == 0) {
    			$$invalidate(0, display = false);
    		}
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ResetPassword> was created with unknown prop '${key}'`);
    	});

    	function input_input_handler() {
    		email = this.value;
    		$$invalidate(3, email);
    	}

    	function input0_input_handler() {
    		otp = this.value;
    		$$invalidate(4, otp);
    	}

    	function input1_input_handler() {
    		password = this.value;
    		$$invalidate(5, password);
    	}

    	$$self.$capture_state = () => ({
    		check,
    		reset,
    		Alert,
    		display,
    		status,
    		mssg,
    		email,
    		otp,
    		password,
    		rpass
    	});

    	$$self.$inject_state = $$props => {
    		if ('display' in $$props) $$invalidate(0, display = $$props.display);
    		if ('status' in $$props) $$invalidate(1, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(2, mssg = $$props.mssg);
    		if ('email' in $$props) $$invalidate(3, email = $$props.email);
    		if ('otp' in $$props) $$invalidate(4, otp = $$props.otp);
    		if ('password' in $$props) $$invalidate(5, password = $$props.password);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		display,
    		status,
    		mssg,
    		email,
    		otp,
    		password,
    		rpass,
    		input_input_handler,
    		input0_input_handler,
    		input1_input_handler
    	];
    }

    class ResetPassword extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ResetPassword",
    			options,
    			id: create_fragment$b.name
    		});
    	}
    }

    var moment$1 = {exports: {}};

    (function (module, exports) {
    (function (global, factory) {
        module.exports = factory() ;
    }(commonjsGlobal, (function () {
        var hookCallback;

        function hooks() {
            return hookCallback.apply(null, arguments);
        }

        // This is done to register the method called with moment()
        // without creating circular dependencies.
        function setHookCallback(callback) {
            hookCallback = callback;
        }

        function isArray(input) {
            return (
                input instanceof Array ||
                Object.prototype.toString.call(input) === '[object Array]'
            );
        }

        function isObject(input) {
            // IE8 will treat undefined and null as object if it wasn't for
            // input != null
            return (
                input != null &&
                Object.prototype.toString.call(input) === '[object Object]'
            );
        }

        function hasOwnProp(a, b) {
            return Object.prototype.hasOwnProperty.call(a, b);
        }

        function isObjectEmpty(obj) {
            if (Object.getOwnPropertyNames) {
                return Object.getOwnPropertyNames(obj).length === 0;
            } else {
                var k;
                for (k in obj) {
                    if (hasOwnProp(obj, k)) {
                        return false;
                    }
                }
                return true;
            }
        }

        function isUndefined(input) {
            return input === void 0;
        }

        function isNumber(input) {
            return (
                typeof input === 'number' ||
                Object.prototype.toString.call(input) === '[object Number]'
            );
        }

        function isDate(input) {
            return (
                input instanceof Date ||
                Object.prototype.toString.call(input) === '[object Date]'
            );
        }

        function map(arr, fn) {
            var res = [],
                i,
                arrLen = arr.length;
            for (i = 0; i < arrLen; ++i) {
                res.push(fn(arr[i], i));
            }
            return res;
        }

        function extend(a, b) {
            for (var i in b) {
                if (hasOwnProp(b, i)) {
                    a[i] = b[i];
                }
            }

            if (hasOwnProp(b, 'toString')) {
                a.toString = b.toString;
            }

            if (hasOwnProp(b, 'valueOf')) {
                a.valueOf = b.valueOf;
            }

            return a;
        }

        function createUTC(input, format, locale, strict) {
            return createLocalOrUTC(input, format, locale, strict, true).utc();
        }

        function defaultParsingFlags() {
            // We need to deep clone this object.
            return {
                empty: false,
                unusedTokens: [],
                unusedInput: [],
                overflow: -2,
                charsLeftOver: 0,
                nullInput: false,
                invalidEra: null,
                invalidMonth: null,
                invalidFormat: false,
                userInvalidated: false,
                iso: false,
                parsedDateParts: [],
                era: null,
                meridiem: null,
                rfc2822: false,
                weekdayMismatch: false,
            };
        }

        function getParsingFlags(m) {
            if (m._pf == null) {
                m._pf = defaultParsingFlags();
            }
            return m._pf;
        }

        var some;
        if (Array.prototype.some) {
            some = Array.prototype.some;
        } else {
            some = function (fun) {
                var t = Object(this),
                    len = t.length >>> 0,
                    i;

                for (i = 0; i < len; i++) {
                    if (i in t && fun.call(this, t[i], i, t)) {
                        return true;
                    }
                }

                return false;
            };
        }

        function isValid(m) {
            if (m._isValid == null) {
                var flags = getParsingFlags(m),
                    parsedParts = some.call(flags.parsedDateParts, function (i) {
                        return i != null;
                    }),
                    isNowValid =
                        !isNaN(m._d.getTime()) &&
                        flags.overflow < 0 &&
                        !flags.empty &&
                        !flags.invalidEra &&
                        !flags.invalidMonth &&
                        !flags.invalidWeekday &&
                        !flags.weekdayMismatch &&
                        !flags.nullInput &&
                        !flags.invalidFormat &&
                        !flags.userInvalidated &&
                        (!flags.meridiem || (flags.meridiem && parsedParts));

                if (m._strict) {
                    isNowValid =
                        isNowValid &&
                        flags.charsLeftOver === 0 &&
                        flags.unusedTokens.length === 0 &&
                        flags.bigHour === undefined;
                }

                if (Object.isFrozen == null || !Object.isFrozen(m)) {
                    m._isValid = isNowValid;
                } else {
                    return isNowValid;
                }
            }
            return m._isValid;
        }

        function createInvalid(flags) {
            var m = createUTC(NaN);
            if (flags != null) {
                extend(getParsingFlags(m), flags);
            } else {
                getParsingFlags(m).userInvalidated = true;
            }

            return m;
        }

        // Plugins that add properties should also add the key here (null value),
        // so we can properly clone ourselves.
        var momentProperties = (hooks.momentProperties = []),
            updateInProgress = false;

        function copyConfig(to, from) {
            var i,
                prop,
                val,
                momentPropertiesLen = momentProperties.length;

            if (!isUndefined(from._isAMomentObject)) {
                to._isAMomentObject = from._isAMomentObject;
            }
            if (!isUndefined(from._i)) {
                to._i = from._i;
            }
            if (!isUndefined(from._f)) {
                to._f = from._f;
            }
            if (!isUndefined(from._l)) {
                to._l = from._l;
            }
            if (!isUndefined(from._strict)) {
                to._strict = from._strict;
            }
            if (!isUndefined(from._tzm)) {
                to._tzm = from._tzm;
            }
            if (!isUndefined(from._isUTC)) {
                to._isUTC = from._isUTC;
            }
            if (!isUndefined(from._offset)) {
                to._offset = from._offset;
            }
            if (!isUndefined(from._pf)) {
                to._pf = getParsingFlags(from);
            }
            if (!isUndefined(from._locale)) {
                to._locale = from._locale;
            }

            if (momentPropertiesLen > 0) {
                for (i = 0; i < momentPropertiesLen; i++) {
                    prop = momentProperties[i];
                    val = from[prop];
                    if (!isUndefined(val)) {
                        to[prop] = val;
                    }
                }
            }

            return to;
        }

        // Moment prototype object
        function Moment(config) {
            copyConfig(this, config);
            this._d = new Date(config._d != null ? config._d.getTime() : NaN);
            if (!this.isValid()) {
                this._d = new Date(NaN);
            }
            // Prevent infinite loop in case updateOffset creates new moment
            // objects.
            if (updateInProgress === false) {
                updateInProgress = true;
                hooks.updateOffset(this);
                updateInProgress = false;
            }
        }

        function isMoment(obj) {
            return (
                obj instanceof Moment || (obj != null && obj._isAMomentObject != null)
            );
        }

        function warn(msg) {
            if (
                hooks.suppressDeprecationWarnings === false &&
                typeof console !== 'undefined' &&
                console.warn
            ) {
                console.warn('Deprecation warning: ' + msg);
            }
        }

        function deprecate(msg, fn) {
            var firstTime = true;

            return extend(function () {
                if (hooks.deprecationHandler != null) {
                    hooks.deprecationHandler(null, msg);
                }
                if (firstTime) {
                    var args = [],
                        arg,
                        i,
                        key,
                        argLen = arguments.length;
                    for (i = 0; i < argLen; i++) {
                        arg = '';
                        if (typeof arguments[i] === 'object') {
                            arg += '\n[' + i + '] ';
                            for (key in arguments[0]) {
                                if (hasOwnProp(arguments[0], key)) {
                                    arg += key + ': ' + arguments[0][key] + ', ';
                                }
                            }
                            arg = arg.slice(0, -2); // Remove trailing comma and space
                        } else {
                            arg = arguments[i];
                        }
                        args.push(arg);
                    }
                    warn(
                        msg +
                            '\nArguments: ' +
                            Array.prototype.slice.call(args).join('') +
                            '\n' +
                            new Error().stack
                    );
                    firstTime = false;
                }
                return fn.apply(this, arguments);
            }, fn);
        }

        var deprecations = {};

        function deprecateSimple(name, msg) {
            if (hooks.deprecationHandler != null) {
                hooks.deprecationHandler(name, msg);
            }
            if (!deprecations[name]) {
                warn(msg);
                deprecations[name] = true;
            }
        }

        hooks.suppressDeprecationWarnings = false;
        hooks.deprecationHandler = null;

        function isFunction(input) {
            return (
                (typeof Function !== 'undefined' && input instanceof Function) ||
                Object.prototype.toString.call(input) === '[object Function]'
            );
        }

        function set(config) {
            var prop, i;
            for (i in config) {
                if (hasOwnProp(config, i)) {
                    prop = config[i];
                    if (isFunction(prop)) {
                        this[i] = prop;
                    } else {
                        this['_' + i] = prop;
                    }
                }
            }
            this._config = config;
            // Lenient ordinal parsing accepts just a number in addition to
            // number + (possibly) stuff coming from _dayOfMonthOrdinalParse.
            // TODO: Remove "ordinalParse" fallback in next major release.
            this._dayOfMonthOrdinalParseLenient = new RegExp(
                (this._dayOfMonthOrdinalParse.source || this._ordinalParse.source) +
                    '|' +
                    /\d{1,2}/.source
            );
        }

        function mergeConfigs(parentConfig, childConfig) {
            var res = extend({}, parentConfig),
                prop;
            for (prop in childConfig) {
                if (hasOwnProp(childConfig, prop)) {
                    if (isObject(parentConfig[prop]) && isObject(childConfig[prop])) {
                        res[prop] = {};
                        extend(res[prop], parentConfig[prop]);
                        extend(res[prop], childConfig[prop]);
                    } else if (childConfig[prop] != null) {
                        res[prop] = childConfig[prop];
                    } else {
                        delete res[prop];
                    }
                }
            }
            for (prop in parentConfig) {
                if (
                    hasOwnProp(parentConfig, prop) &&
                    !hasOwnProp(childConfig, prop) &&
                    isObject(parentConfig[prop])
                ) {
                    // make sure changes to properties don't modify parent config
                    res[prop] = extend({}, res[prop]);
                }
            }
            return res;
        }

        function Locale(config) {
            if (config != null) {
                this.set(config);
            }
        }

        var keys;

        if (Object.keys) {
            keys = Object.keys;
        } else {
            keys = function (obj) {
                var i,
                    res = [];
                for (i in obj) {
                    if (hasOwnProp(obj, i)) {
                        res.push(i);
                    }
                }
                return res;
            };
        }

        var defaultCalendar = {
            sameDay: '[Today at] LT',
            nextDay: '[Tomorrow at] LT',
            nextWeek: 'dddd [at] LT',
            lastDay: '[Yesterday at] LT',
            lastWeek: '[Last] dddd [at] LT',
            sameElse: 'L',
        };

        function calendar(key, mom, now) {
            var output = this._calendar[key] || this._calendar['sameElse'];
            return isFunction(output) ? output.call(mom, now) : output;
        }

        function zeroFill(number, targetLength, forceSign) {
            var absNumber = '' + Math.abs(number),
                zerosToFill = targetLength - absNumber.length,
                sign = number >= 0;
            return (
                (sign ? (forceSign ? '+' : '') : '-') +
                Math.pow(10, Math.max(0, zerosToFill)).toString().substr(1) +
                absNumber
            );
        }

        var formattingTokens =
                /(\[[^\[]*\])|(\\)?([Hh]mm(ss)?|Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Qo?|N{1,5}|YYYYYY|YYYYY|YYYY|YY|y{2,4}|yo?|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|kk?|mm?|ss?|S{1,9}|x|X|zz?|ZZ?|.)/g,
            localFormattingTokens = /(\[[^\[]*\])|(\\)?(LTS|LT|LL?L?L?|l{1,4})/g,
            formatFunctions = {},
            formatTokenFunctions = {};

        // token:    'M'
        // padded:   ['MM', 2]
        // ordinal:  'Mo'
        // callback: function () { this.month() + 1 }
        function addFormatToken(token, padded, ordinal, callback) {
            var func = callback;
            if (typeof callback === 'string') {
                func = function () {
                    return this[callback]();
                };
            }
            if (token) {
                formatTokenFunctions[token] = func;
            }
            if (padded) {
                formatTokenFunctions[padded[0]] = function () {
                    return zeroFill(func.apply(this, arguments), padded[1], padded[2]);
                };
            }
            if (ordinal) {
                formatTokenFunctions[ordinal] = function () {
                    return this.localeData().ordinal(
                        func.apply(this, arguments),
                        token
                    );
                };
            }
        }

        function removeFormattingTokens(input) {
            if (input.match(/\[[\s\S]/)) {
                return input.replace(/^\[|\]$/g, '');
            }
            return input.replace(/\\/g, '');
        }

        function makeFormatFunction(format) {
            var array = format.match(formattingTokens),
                i,
                length;

            for (i = 0, length = array.length; i < length; i++) {
                if (formatTokenFunctions[array[i]]) {
                    array[i] = formatTokenFunctions[array[i]];
                } else {
                    array[i] = removeFormattingTokens(array[i]);
                }
            }

            return function (mom) {
                var output = '',
                    i;
                for (i = 0; i < length; i++) {
                    output += isFunction(array[i])
                        ? array[i].call(mom, format)
                        : array[i];
                }
                return output;
            };
        }

        // format date using native date object
        function formatMoment(m, format) {
            if (!m.isValid()) {
                return m.localeData().invalidDate();
            }

            format = expandFormat(format, m.localeData());
            formatFunctions[format] =
                formatFunctions[format] || makeFormatFunction(format);

            return formatFunctions[format](m);
        }

        function expandFormat(format, locale) {
            var i = 5;

            function replaceLongDateFormatTokens(input) {
                return locale.longDateFormat(input) || input;
            }

            localFormattingTokens.lastIndex = 0;
            while (i >= 0 && localFormattingTokens.test(format)) {
                format = format.replace(
                    localFormattingTokens,
                    replaceLongDateFormatTokens
                );
                localFormattingTokens.lastIndex = 0;
                i -= 1;
            }

            return format;
        }

        var defaultLongDateFormat = {
            LTS: 'h:mm:ss A',
            LT: 'h:mm A',
            L: 'MM/DD/YYYY',
            LL: 'MMMM D, YYYY',
            LLL: 'MMMM D, YYYY h:mm A',
            LLLL: 'dddd, MMMM D, YYYY h:mm A',
        };

        function longDateFormat(key) {
            var format = this._longDateFormat[key],
                formatUpper = this._longDateFormat[key.toUpperCase()];

            if (format || !formatUpper) {
                return format;
            }

            this._longDateFormat[key] = formatUpper
                .match(formattingTokens)
                .map(function (tok) {
                    if (
                        tok === 'MMMM' ||
                        tok === 'MM' ||
                        tok === 'DD' ||
                        tok === 'dddd'
                    ) {
                        return tok.slice(1);
                    }
                    return tok;
                })
                .join('');

            return this._longDateFormat[key];
        }

        var defaultInvalidDate = 'Invalid date';

        function invalidDate() {
            return this._invalidDate;
        }

        var defaultOrdinal = '%d',
            defaultDayOfMonthOrdinalParse = /\d{1,2}/;

        function ordinal(number) {
            return this._ordinal.replace('%d', number);
        }

        var defaultRelativeTime = {
            future: 'in %s',
            past: '%s ago',
            s: 'a few seconds',
            ss: '%d seconds',
            m: 'a minute',
            mm: '%d minutes',
            h: 'an hour',
            hh: '%d hours',
            d: 'a day',
            dd: '%d days',
            w: 'a week',
            ww: '%d weeks',
            M: 'a month',
            MM: '%d months',
            y: 'a year',
            yy: '%d years',
        };

        function relativeTime(number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return isFunction(output)
                ? output(number, withoutSuffix, string, isFuture)
                : output.replace(/%d/i, number);
        }

        function pastFuture(diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return isFunction(format) ? format(output) : format.replace(/%s/i, output);
        }

        var aliases = {};

        function addUnitAlias(unit, shorthand) {
            var lowerCase = unit.toLowerCase();
            aliases[lowerCase] = aliases[lowerCase + 's'] = aliases[shorthand] = unit;
        }

        function normalizeUnits(units) {
            return typeof units === 'string'
                ? aliases[units] || aliases[units.toLowerCase()]
                : undefined;
        }

        function normalizeObjectUnits(inputObject) {
            var normalizedInput = {},
                normalizedProp,
                prop;

            for (prop in inputObject) {
                if (hasOwnProp(inputObject, prop)) {
                    normalizedProp = normalizeUnits(prop);
                    if (normalizedProp) {
                        normalizedInput[normalizedProp] = inputObject[prop];
                    }
                }
            }

            return normalizedInput;
        }

        var priorities = {};

        function addUnitPriority(unit, priority) {
            priorities[unit] = priority;
        }

        function getPrioritizedUnits(unitsObj) {
            var units = [],
                u;
            for (u in unitsObj) {
                if (hasOwnProp(unitsObj, u)) {
                    units.push({ unit: u, priority: priorities[u] });
                }
            }
            units.sort(function (a, b) {
                return a.priority - b.priority;
            });
            return units;
        }

        function isLeapYear(year) {
            return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
        }

        function absFloor(number) {
            if (number < 0) {
                // -0 -> 0
                return Math.ceil(number) || 0;
            } else {
                return Math.floor(number);
            }
        }

        function toInt(argumentForCoercion) {
            var coercedNumber = +argumentForCoercion,
                value = 0;

            if (coercedNumber !== 0 && isFinite(coercedNumber)) {
                value = absFloor(coercedNumber);
            }

            return value;
        }

        function makeGetSet(unit, keepTime) {
            return function (value) {
                if (value != null) {
                    set$1(this, unit, value);
                    hooks.updateOffset(this, keepTime);
                    return this;
                } else {
                    return get(this, unit);
                }
            };
        }

        function get(mom, unit) {
            return mom.isValid()
                ? mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]()
                : NaN;
        }

        function set$1(mom, unit, value) {
            if (mom.isValid() && !isNaN(value)) {
                if (
                    unit === 'FullYear' &&
                    isLeapYear(mom.year()) &&
                    mom.month() === 1 &&
                    mom.date() === 29
                ) {
                    value = toInt(value);
                    mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](
                        value,
                        mom.month(),
                        daysInMonth(value, mom.month())
                    );
                } else {
                    mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
                }
            }
        }

        // MOMENTS

        function stringGet(units) {
            units = normalizeUnits(units);
            if (isFunction(this[units])) {
                return this[units]();
            }
            return this;
        }

        function stringSet(units, value) {
            if (typeof units === 'object') {
                units = normalizeObjectUnits(units);
                var prioritized = getPrioritizedUnits(units),
                    i,
                    prioritizedLen = prioritized.length;
                for (i = 0; i < prioritizedLen; i++) {
                    this[prioritized[i].unit](units[prioritized[i].unit]);
                }
            } else {
                units = normalizeUnits(units);
                if (isFunction(this[units])) {
                    return this[units](value);
                }
            }
            return this;
        }

        var match1 = /\d/, //       0 - 9
            match2 = /\d\d/, //      00 - 99
            match3 = /\d{3}/, //     000 - 999
            match4 = /\d{4}/, //    0000 - 9999
            match6 = /[+-]?\d{6}/, // -999999 - 999999
            match1to2 = /\d\d?/, //       0 - 99
            match3to4 = /\d\d\d\d?/, //     999 - 9999
            match5to6 = /\d\d\d\d\d\d?/, //   99999 - 999999
            match1to3 = /\d{1,3}/, //       0 - 999
            match1to4 = /\d{1,4}/, //       0 - 9999
            match1to6 = /[+-]?\d{1,6}/, // -999999 - 999999
            matchUnsigned = /\d+/, //       0 - inf
            matchSigned = /[+-]?\d+/, //    -inf - inf
            matchOffset = /Z|[+-]\d\d:?\d\d/gi, // +00:00 -00:00 +0000 -0000 or Z
            matchShortOffset = /Z|[+-]\d\d(?::?\d\d)?/gi, // +00 -00 +00:00 -00:00 +0000 -0000 or Z
            matchTimestamp = /[+-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123
            // any word (or two) characters or numbers including two/three word month in arabic.
            // includes scottish gaelic two word and hyphenated months
            matchWord =
                /[0-9]{0,256}['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFF07\uFF10-\uFFEF]{1,256}|[\u0600-\u06FF\/]{1,256}(\s*?[\u0600-\u06FF]{1,256}){1,2}/i,
            regexes;

        regexes = {};

        function addRegexToken(token, regex, strictRegex) {
            regexes[token] = isFunction(regex)
                ? regex
                : function (isStrict, localeData) {
                      return isStrict && strictRegex ? strictRegex : regex;
                  };
        }

        function getParseRegexForToken(token, config) {
            if (!hasOwnProp(regexes, token)) {
                return new RegExp(unescapeFormat(token));
            }

            return regexes[token](config._strict, config._locale);
        }

        // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
        function unescapeFormat(s) {
            return regexEscape(
                s
                    .replace('\\', '')
                    .replace(
                        /\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g,
                        function (matched, p1, p2, p3, p4) {
                            return p1 || p2 || p3 || p4;
                        }
                    )
            );
        }

        function regexEscape(s) {
            return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        }

        var tokens = {};

        function addParseToken(token, callback) {
            var i,
                func = callback,
                tokenLen;
            if (typeof token === 'string') {
                token = [token];
            }
            if (isNumber(callback)) {
                func = function (input, array) {
                    array[callback] = toInt(input);
                };
            }
            tokenLen = token.length;
            for (i = 0; i < tokenLen; i++) {
                tokens[token[i]] = func;
            }
        }

        function addWeekParseToken(token, callback) {
            addParseToken(token, function (input, array, config, token) {
                config._w = config._w || {};
                callback(input, config._w, config, token);
            });
        }

        function addTimeToArrayFromToken(token, input, config) {
            if (input != null && hasOwnProp(tokens, token)) {
                tokens[token](input, config._a, config, token);
            }
        }

        var YEAR = 0,
            MONTH = 1,
            DATE = 2,
            HOUR = 3,
            MINUTE = 4,
            SECOND = 5,
            MILLISECOND = 6,
            WEEK = 7,
            WEEKDAY = 8;

        function mod(n, x) {
            return ((n % x) + x) % x;
        }

        var indexOf;

        if (Array.prototype.indexOf) {
            indexOf = Array.prototype.indexOf;
        } else {
            indexOf = function (o) {
                // I know
                var i;
                for (i = 0; i < this.length; ++i) {
                    if (this[i] === o) {
                        return i;
                    }
                }
                return -1;
            };
        }

        function daysInMonth(year, month) {
            if (isNaN(year) || isNaN(month)) {
                return NaN;
            }
            var modMonth = mod(month, 12);
            year += (month - modMonth) / 12;
            return modMonth === 1
                ? isLeapYear(year)
                    ? 29
                    : 28
                : 31 - ((modMonth % 7) % 2);
        }

        // FORMATTING

        addFormatToken('M', ['MM', 2], 'Mo', function () {
            return this.month() + 1;
        });

        addFormatToken('MMM', 0, 0, function (format) {
            return this.localeData().monthsShort(this, format);
        });

        addFormatToken('MMMM', 0, 0, function (format) {
            return this.localeData().months(this, format);
        });

        // ALIASES

        addUnitAlias('month', 'M');

        // PRIORITY

        addUnitPriority('month', 8);

        // PARSING

        addRegexToken('M', match1to2);
        addRegexToken('MM', match1to2, match2);
        addRegexToken('MMM', function (isStrict, locale) {
            return locale.monthsShortRegex(isStrict);
        });
        addRegexToken('MMMM', function (isStrict, locale) {
            return locale.monthsRegex(isStrict);
        });

        addParseToken(['M', 'MM'], function (input, array) {
            array[MONTH] = toInt(input) - 1;
        });

        addParseToken(['MMM', 'MMMM'], function (input, array, config, token) {
            var month = config._locale.monthsParse(input, token, config._strict);
            // if we didn't find a month name, mark the date as invalid.
            if (month != null) {
                array[MONTH] = month;
            } else {
                getParsingFlags(config).invalidMonth = input;
            }
        });

        // LOCALES

        var defaultLocaleMonths =
                'January_February_March_April_May_June_July_August_September_October_November_December'.split(
                    '_'
                ),
            defaultLocaleMonthsShort =
                'Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec'.split('_'),
            MONTHS_IN_FORMAT = /D[oD]?(\[[^\[\]]*\]|\s)+MMMM?/,
            defaultMonthsShortRegex = matchWord,
            defaultMonthsRegex = matchWord;

        function localeMonths(m, format) {
            if (!m) {
                return isArray(this._months)
                    ? this._months
                    : this._months['standalone'];
            }
            return isArray(this._months)
                ? this._months[m.month()]
                : this._months[
                      (this._months.isFormat || MONTHS_IN_FORMAT).test(format)
                          ? 'format'
                          : 'standalone'
                  ][m.month()];
        }

        function localeMonthsShort(m, format) {
            if (!m) {
                return isArray(this._monthsShort)
                    ? this._monthsShort
                    : this._monthsShort['standalone'];
            }
            return isArray(this._monthsShort)
                ? this._monthsShort[m.month()]
                : this._monthsShort[
                      MONTHS_IN_FORMAT.test(format) ? 'format' : 'standalone'
                  ][m.month()];
        }

        function handleStrictParse(monthName, format, strict) {
            var i,
                ii,
                mom,
                llc = monthName.toLocaleLowerCase();
            if (!this._monthsParse) {
                // this is not used
                this._monthsParse = [];
                this._longMonthsParse = [];
                this._shortMonthsParse = [];
                for (i = 0; i < 12; ++i) {
                    mom = createUTC([2000, i]);
                    this._shortMonthsParse[i] = this.monthsShort(
                        mom,
                        ''
                    ).toLocaleLowerCase();
                    this._longMonthsParse[i] = this.months(mom, '').toLocaleLowerCase();
                }
            }

            if (strict) {
                if (format === 'MMM') {
                    ii = indexOf.call(this._shortMonthsParse, llc);
                    return ii !== -1 ? ii : null;
                } else {
                    ii = indexOf.call(this._longMonthsParse, llc);
                    return ii !== -1 ? ii : null;
                }
            } else {
                if (format === 'MMM') {
                    ii = indexOf.call(this._shortMonthsParse, llc);
                    if (ii !== -1) {
                        return ii;
                    }
                    ii = indexOf.call(this._longMonthsParse, llc);
                    return ii !== -1 ? ii : null;
                } else {
                    ii = indexOf.call(this._longMonthsParse, llc);
                    if (ii !== -1) {
                        return ii;
                    }
                    ii = indexOf.call(this._shortMonthsParse, llc);
                    return ii !== -1 ? ii : null;
                }
            }
        }

        function localeMonthsParse(monthName, format, strict) {
            var i, mom, regex;

            if (this._monthsParseExact) {
                return handleStrictParse.call(this, monthName, format, strict);
            }

            if (!this._monthsParse) {
                this._monthsParse = [];
                this._longMonthsParse = [];
                this._shortMonthsParse = [];
            }

            // TODO: add sorting
            // Sorting makes sure if one month (or abbr) is a prefix of another
            // see sorting in computeMonthsParse
            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                mom = createUTC([2000, i]);
                if (strict && !this._longMonthsParse[i]) {
                    this._longMonthsParse[i] = new RegExp(
                        '^' + this.months(mom, '').replace('.', '') + '$',
                        'i'
                    );
                    this._shortMonthsParse[i] = new RegExp(
                        '^' + this.monthsShort(mom, '').replace('.', '') + '$',
                        'i'
                    );
                }
                if (!strict && !this._monthsParse[i]) {
                    regex =
                        '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (
                    strict &&
                    format === 'MMMM' &&
                    this._longMonthsParse[i].test(monthName)
                ) {
                    return i;
                } else if (
                    strict &&
                    format === 'MMM' &&
                    this._shortMonthsParse[i].test(monthName)
                ) {
                    return i;
                } else if (!strict && this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        }

        // MOMENTS

        function setMonth(mom, value) {
            var dayOfMonth;

            if (!mom.isValid()) {
                // No op
                return mom;
            }

            if (typeof value === 'string') {
                if (/^\d+$/.test(value)) {
                    value = toInt(value);
                } else {
                    value = mom.localeData().monthsParse(value);
                    // TODO: Another silent failure?
                    if (!isNumber(value)) {
                        return mom;
                    }
                }
            }

            dayOfMonth = Math.min(mom.date(), daysInMonth(mom.year(), value));
            mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
            return mom;
        }

        function getSetMonth(value) {
            if (value != null) {
                setMonth(this, value);
                hooks.updateOffset(this, true);
                return this;
            } else {
                return get(this, 'Month');
            }
        }

        function getDaysInMonth() {
            return daysInMonth(this.year(), this.month());
        }

        function monthsShortRegex(isStrict) {
            if (this._monthsParseExact) {
                if (!hasOwnProp(this, '_monthsRegex')) {
                    computeMonthsParse.call(this);
                }
                if (isStrict) {
                    return this._monthsShortStrictRegex;
                } else {
                    return this._monthsShortRegex;
                }
            } else {
                if (!hasOwnProp(this, '_monthsShortRegex')) {
                    this._monthsShortRegex = defaultMonthsShortRegex;
                }
                return this._monthsShortStrictRegex && isStrict
                    ? this._monthsShortStrictRegex
                    : this._monthsShortRegex;
            }
        }

        function monthsRegex(isStrict) {
            if (this._monthsParseExact) {
                if (!hasOwnProp(this, '_monthsRegex')) {
                    computeMonthsParse.call(this);
                }
                if (isStrict) {
                    return this._monthsStrictRegex;
                } else {
                    return this._monthsRegex;
                }
            } else {
                if (!hasOwnProp(this, '_monthsRegex')) {
                    this._monthsRegex = defaultMonthsRegex;
                }
                return this._monthsStrictRegex && isStrict
                    ? this._monthsStrictRegex
                    : this._monthsRegex;
            }
        }

        function computeMonthsParse() {
            function cmpLenRev(a, b) {
                return b.length - a.length;
            }

            var shortPieces = [],
                longPieces = [],
                mixedPieces = [],
                i,
                mom;
            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                mom = createUTC([2000, i]);
                shortPieces.push(this.monthsShort(mom, ''));
                longPieces.push(this.months(mom, ''));
                mixedPieces.push(this.months(mom, ''));
                mixedPieces.push(this.monthsShort(mom, ''));
            }
            // Sorting makes sure if one month (or abbr) is a prefix of another it
            // will match the longer piece.
            shortPieces.sort(cmpLenRev);
            longPieces.sort(cmpLenRev);
            mixedPieces.sort(cmpLenRev);
            for (i = 0; i < 12; i++) {
                shortPieces[i] = regexEscape(shortPieces[i]);
                longPieces[i] = regexEscape(longPieces[i]);
            }
            for (i = 0; i < 24; i++) {
                mixedPieces[i] = regexEscape(mixedPieces[i]);
            }

            this._monthsRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
            this._monthsShortRegex = this._monthsRegex;
            this._monthsStrictRegex = new RegExp(
                '^(' + longPieces.join('|') + ')',
                'i'
            );
            this._monthsShortStrictRegex = new RegExp(
                '^(' + shortPieces.join('|') + ')',
                'i'
            );
        }

        // FORMATTING

        addFormatToken('Y', 0, 0, function () {
            var y = this.year();
            return y <= 9999 ? zeroFill(y, 4) : '+' + y;
        });

        addFormatToken(0, ['YY', 2], 0, function () {
            return this.year() % 100;
        });

        addFormatToken(0, ['YYYY', 4], 0, 'year');
        addFormatToken(0, ['YYYYY', 5], 0, 'year');
        addFormatToken(0, ['YYYYYY', 6, true], 0, 'year');

        // ALIASES

        addUnitAlias('year', 'y');

        // PRIORITIES

        addUnitPriority('year', 1);

        // PARSING

        addRegexToken('Y', matchSigned);
        addRegexToken('YY', match1to2, match2);
        addRegexToken('YYYY', match1to4, match4);
        addRegexToken('YYYYY', match1to6, match6);
        addRegexToken('YYYYYY', match1to6, match6);

        addParseToken(['YYYYY', 'YYYYYY'], YEAR);
        addParseToken('YYYY', function (input, array) {
            array[YEAR] =
                input.length === 2 ? hooks.parseTwoDigitYear(input) : toInt(input);
        });
        addParseToken('YY', function (input, array) {
            array[YEAR] = hooks.parseTwoDigitYear(input);
        });
        addParseToken('Y', function (input, array) {
            array[YEAR] = parseInt(input, 10);
        });

        // HELPERS

        function daysInYear(year) {
            return isLeapYear(year) ? 366 : 365;
        }

        // HOOKS

        hooks.parseTwoDigitYear = function (input) {
            return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
        };

        // MOMENTS

        var getSetYear = makeGetSet('FullYear', true);

        function getIsLeapYear() {
            return isLeapYear(this.year());
        }

        function createDate(y, m, d, h, M, s, ms) {
            // can't just apply() to create a date:
            // https://stackoverflow.com/q/181348
            var date;
            // the date constructor remaps years 0-99 to 1900-1999
            if (y < 100 && y >= 0) {
                // preserve leap years using a full 400 year cycle, then reset
                date = new Date(y + 400, m, d, h, M, s, ms);
                if (isFinite(date.getFullYear())) {
                    date.setFullYear(y);
                }
            } else {
                date = new Date(y, m, d, h, M, s, ms);
            }

            return date;
        }

        function createUTCDate(y) {
            var date, args;
            // the Date.UTC function remaps years 0-99 to 1900-1999
            if (y < 100 && y >= 0) {
                args = Array.prototype.slice.call(arguments);
                // preserve leap years using a full 400 year cycle, then reset
                args[0] = y + 400;
                date = new Date(Date.UTC.apply(null, args));
                if (isFinite(date.getUTCFullYear())) {
                    date.setUTCFullYear(y);
                }
            } else {
                date = new Date(Date.UTC.apply(null, arguments));
            }

            return date;
        }

        // start-of-first-week - start-of-year
        function firstWeekOffset(year, dow, doy) {
            var // first-week day -- which january is always in the first week (4 for iso, 1 for other)
                fwd = 7 + dow - doy,
                // first-week day local weekday -- which local weekday is fwd
                fwdlw = (7 + createUTCDate(year, 0, fwd).getUTCDay() - dow) % 7;

            return -fwdlw + fwd - 1;
        }

        // https://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
        function dayOfYearFromWeeks(year, week, weekday, dow, doy) {
            var localWeekday = (7 + weekday - dow) % 7,
                weekOffset = firstWeekOffset(year, dow, doy),
                dayOfYear = 1 + 7 * (week - 1) + localWeekday + weekOffset,
                resYear,
                resDayOfYear;

            if (dayOfYear <= 0) {
                resYear = year - 1;
                resDayOfYear = daysInYear(resYear) + dayOfYear;
            } else if (dayOfYear > daysInYear(year)) {
                resYear = year + 1;
                resDayOfYear = dayOfYear - daysInYear(year);
            } else {
                resYear = year;
                resDayOfYear = dayOfYear;
            }

            return {
                year: resYear,
                dayOfYear: resDayOfYear,
            };
        }

        function weekOfYear(mom, dow, doy) {
            var weekOffset = firstWeekOffset(mom.year(), dow, doy),
                week = Math.floor((mom.dayOfYear() - weekOffset - 1) / 7) + 1,
                resWeek,
                resYear;

            if (week < 1) {
                resYear = mom.year() - 1;
                resWeek = week + weeksInYear(resYear, dow, doy);
            } else if (week > weeksInYear(mom.year(), dow, doy)) {
                resWeek = week - weeksInYear(mom.year(), dow, doy);
                resYear = mom.year() + 1;
            } else {
                resYear = mom.year();
                resWeek = week;
            }

            return {
                week: resWeek,
                year: resYear,
            };
        }

        function weeksInYear(year, dow, doy) {
            var weekOffset = firstWeekOffset(year, dow, doy),
                weekOffsetNext = firstWeekOffset(year + 1, dow, doy);
            return (daysInYear(year) - weekOffset + weekOffsetNext) / 7;
        }

        // FORMATTING

        addFormatToken('w', ['ww', 2], 'wo', 'week');
        addFormatToken('W', ['WW', 2], 'Wo', 'isoWeek');

        // ALIASES

        addUnitAlias('week', 'w');
        addUnitAlias('isoWeek', 'W');

        // PRIORITIES

        addUnitPriority('week', 5);
        addUnitPriority('isoWeek', 5);

        // PARSING

        addRegexToken('w', match1to2);
        addRegexToken('ww', match1to2, match2);
        addRegexToken('W', match1to2);
        addRegexToken('WW', match1to2, match2);

        addWeekParseToken(
            ['w', 'ww', 'W', 'WW'],
            function (input, week, config, token) {
                week[token.substr(0, 1)] = toInt(input);
            }
        );

        // HELPERS

        // LOCALES

        function localeWeek(mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        }

        var defaultLocaleWeek = {
            dow: 0, // Sunday is the first day of the week.
            doy: 6, // The week that contains Jan 6th is the first week of the year.
        };

        function localeFirstDayOfWeek() {
            return this._week.dow;
        }

        function localeFirstDayOfYear() {
            return this._week.doy;
        }

        // MOMENTS

        function getSetWeek(input) {
            var week = this.localeData().week(this);
            return input == null ? week : this.add((input - week) * 7, 'd');
        }

        function getSetISOWeek(input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add((input - week) * 7, 'd');
        }

        // FORMATTING

        addFormatToken('d', 0, 'do', 'day');

        addFormatToken('dd', 0, 0, function (format) {
            return this.localeData().weekdaysMin(this, format);
        });

        addFormatToken('ddd', 0, 0, function (format) {
            return this.localeData().weekdaysShort(this, format);
        });

        addFormatToken('dddd', 0, 0, function (format) {
            return this.localeData().weekdays(this, format);
        });

        addFormatToken('e', 0, 0, 'weekday');
        addFormatToken('E', 0, 0, 'isoWeekday');

        // ALIASES

        addUnitAlias('day', 'd');
        addUnitAlias('weekday', 'e');
        addUnitAlias('isoWeekday', 'E');

        // PRIORITY
        addUnitPriority('day', 11);
        addUnitPriority('weekday', 11);
        addUnitPriority('isoWeekday', 11);

        // PARSING

        addRegexToken('d', match1to2);
        addRegexToken('e', match1to2);
        addRegexToken('E', match1to2);
        addRegexToken('dd', function (isStrict, locale) {
            return locale.weekdaysMinRegex(isStrict);
        });
        addRegexToken('ddd', function (isStrict, locale) {
            return locale.weekdaysShortRegex(isStrict);
        });
        addRegexToken('dddd', function (isStrict, locale) {
            return locale.weekdaysRegex(isStrict);
        });

        addWeekParseToken(['dd', 'ddd', 'dddd'], function (input, week, config, token) {
            var weekday = config._locale.weekdaysParse(input, token, config._strict);
            // if we didn't get a weekday name, mark the date as invalid
            if (weekday != null) {
                week.d = weekday;
            } else {
                getParsingFlags(config).invalidWeekday = input;
            }
        });

        addWeekParseToken(['d', 'e', 'E'], function (input, week, config, token) {
            week[token] = toInt(input);
        });

        // HELPERS

        function parseWeekday(input, locale) {
            if (typeof input !== 'string') {
                return input;
            }

            if (!isNaN(input)) {
                return parseInt(input, 10);
            }

            input = locale.weekdaysParse(input);
            if (typeof input === 'number') {
                return input;
            }

            return null;
        }

        function parseIsoWeekday(input, locale) {
            if (typeof input === 'string') {
                return locale.weekdaysParse(input) % 7 || 7;
            }
            return isNaN(input) ? null : input;
        }

        // LOCALES
        function shiftWeekdays(ws, n) {
            return ws.slice(n, 7).concat(ws.slice(0, n));
        }

        var defaultLocaleWeekdays =
                'Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday'.split('_'),
            defaultLocaleWeekdaysShort = 'Sun_Mon_Tue_Wed_Thu_Fri_Sat'.split('_'),
            defaultLocaleWeekdaysMin = 'Su_Mo_Tu_We_Th_Fr_Sa'.split('_'),
            defaultWeekdaysRegex = matchWord,
            defaultWeekdaysShortRegex = matchWord,
            defaultWeekdaysMinRegex = matchWord;

        function localeWeekdays(m, format) {
            var weekdays = isArray(this._weekdays)
                ? this._weekdays
                : this._weekdays[
                      m && m !== true && this._weekdays.isFormat.test(format)
                          ? 'format'
                          : 'standalone'
                  ];
            return m === true
                ? shiftWeekdays(weekdays, this._week.dow)
                : m
                ? weekdays[m.day()]
                : weekdays;
        }

        function localeWeekdaysShort(m) {
            return m === true
                ? shiftWeekdays(this._weekdaysShort, this._week.dow)
                : m
                ? this._weekdaysShort[m.day()]
                : this._weekdaysShort;
        }

        function localeWeekdaysMin(m) {
            return m === true
                ? shiftWeekdays(this._weekdaysMin, this._week.dow)
                : m
                ? this._weekdaysMin[m.day()]
                : this._weekdaysMin;
        }

        function handleStrictParse$1(weekdayName, format, strict) {
            var i,
                ii,
                mom,
                llc = weekdayName.toLocaleLowerCase();
            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
                this._shortWeekdaysParse = [];
                this._minWeekdaysParse = [];

                for (i = 0; i < 7; ++i) {
                    mom = createUTC([2000, 1]).day(i);
                    this._minWeekdaysParse[i] = this.weekdaysMin(
                        mom,
                        ''
                    ).toLocaleLowerCase();
                    this._shortWeekdaysParse[i] = this.weekdaysShort(
                        mom,
                        ''
                    ).toLocaleLowerCase();
                    this._weekdaysParse[i] = this.weekdays(mom, '').toLocaleLowerCase();
                }
            }

            if (strict) {
                if (format === 'dddd') {
                    ii = indexOf.call(this._weekdaysParse, llc);
                    return ii !== -1 ? ii : null;
                } else if (format === 'ddd') {
                    ii = indexOf.call(this._shortWeekdaysParse, llc);
                    return ii !== -1 ? ii : null;
                } else {
                    ii = indexOf.call(this._minWeekdaysParse, llc);
                    return ii !== -1 ? ii : null;
                }
            } else {
                if (format === 'dddd') {
                    ii = indexOf.call(this._weekdaysParse, llc);
                    if (ii !== -1) {
                        return ii;
                    }
                    ii = indexOf.call(this._shortWeekdaysParse, llc);
                    if (ii !== -1) {
                        return ii;
                    }
                    ii = indexOf.call(this._minWeekdaysParse, llc);
                    return ii !== -1 ? ii : null;
                } else if (format === 'ddd') {
                    ii = indexOf.call(this._shortWeekdaysParse, llc);
                    if (ii !== -1) {
                        return ii;
                    }
                    ii = indexOf.call(this._weekdaysParse, llc);
                    if (ii !== -1) {
                        return ii;
                    }
                    ii = indexOf.call(this._minWeekdaysParse, llc);
                    return ii !== -1 ? ii : null;
                } else {
                    ii = indexOf.call(this._minWeekdaysParse, llc);
                    if (ii !== -1) {
                        return ii;
                    }
                    ii = indexOf.call(this._weekdaysParse, llc);
                    if (ii !== -1) {
                        return ii;
                    }
                    ii = indexOf.call(this._shortWeekdaysParse, llc);
                    return ii !== -1 ? ii : null;
                }
            }
        }

        function localeWeekdaysParse(weekdayName, format, strict) {
            var i, mom, regex;

            if (this._weekdaysParseExact) {
                return handleStrictParse$1.call(this, weekdayName, format, strict);
            }

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
                this._minWeekdaysParse = [];
                this._shortWeekdaysParse = [];
                this._fullWeekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already

                mom = createUTC([2000, 1]).day(i);
                if (strict && !this._fullWeekdaysParse[i]) {
                    this._fullWeekdaysParse[i] = new RegExp(
                        '^' + this.weekdays(mom, '').replace('.', '\\.?') + '$',
                        'i'
                    );
                    this._shortWeekdaysParse[i] = new RegExp(
                        '^' + this.weekdaysShort(mom, '').replace('.', '\\.?') + '$',
                        'i'
                    );
                    this._minWeekdaysParse[i] = new RegExp(
                        '^' + this.weekdaysMin(mom, '').replace('.', '\\.?') + '$',
                        'i'
                    );
                }
                if (!this._weekdaysParse[i]) {
                    regex =
                        '^' +
                        this.weekdays(mom, '') +
                        '|^' +
                        this.weekdaysShort(mom, '') +
                        '|^' +
                        this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (
                    strict &&
                    format === 'dddd' &&
                    this._fullWeekdaysParse[i].test(weekdayName)
                ) {
                    return i;
                } else if (
                    strict &&
                    format === 'ddd' &&
                    this._shortWeekdaysParse[i].test(weekdayName)
                ) {
                    return i;
                } else if (
                    strict &&
                    format === 'dd' &&
                    this._minWeekdaysParse[i].test(weekdayName)
                ) {
                    return i;
                } else if (!strict && this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        }

        // MOMENTS

        function getSetDayOfWeek(input) {
            if (!this.isValid()) {
                return input != null ? this : NaN;
            }
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                input = parseWeekday(input, this.localeData());
                return this.add(input - day, 'd');
            } else {
                return day;
            }
        }

        function getSetLocaleDayOfWeek(input) {
            if (!this.isValid()) {
                return input != null ? this : NaN;
            }
            var weekday = (this.day() + 7 - this.localeData()._week.dow) % 7;
            return input == null ? weekday : this.add(input - weekday, 'd');
        }

        function getSetISODayOfWeek(input) {
            if (!this.isValid()) {
                return input != null ? this : NaN;
            }

            // behaves the same as moment#day except
            // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
            // as a setter, sunday should belong to the previous week.

            if (input != null) {
                var weekday = parseIsoWeekday(input, this.localeData());
                return this.day(this.day() % 7 ? weekday : weekday - 7);
            } else {
                return this.day() || 7;
            }
        }

        function weekdaysRegex(isStrict) {
            if (this._weekdaysParseExact) {
                if (!hasOwnProp(this, '_weekdaysRegex')) {
                    computeWeekdaysParse.call(this);
                }
                if (isStrict) {
                    return this._weekdaysStrictRegex;
                } else {
                    return this._weekdaysRegex;
                }
            } else {
                if (!hasOwnProp(this, '_weekdaysRegex')) {
                    this._weekdaysRegex = defaultWeekdaysRegex;
                }
                return this._weekdaysStrictRegex && isStrict
                    ? this._weekdaysStrictRegex
                    : this._weekdaysRegex;
            }
        }

        function weekdaysShortRegex(isStrict) {
            if (this._weekdaysParseExact) {
                if (!hasOwnProp(this, '_weekdaysRegex')) {
                    computeWeekdaysParse.call(this);
                }
                if (isStrict) {
                    return this._weekdaysShortStrictRegex;
                } else {
                    return this._weekdaysShortRegex;
                }
            } else {
                if (!hasOwnProp(this, '_weekdaysShortRegex')) {
                    this._weekdaysShortRegex = defaultWeekdaysShortRegex;
                }
                return this._weekdaysShortStrictRegex && isStrict
                    ? this._weekdaysShortStrictRegex
                    : this._weekdaysShortRegex;
            }
        }

        function weekdaysMinRegex(isStrict) {
            if (this._weekdaysParseExact) {
                if (!hasOwnProp(this, '_weekdaysRegex')) {
                    computeWeekdaysParse.call(this);
                }
                if (isStrict) {
                    return this._weekdaysMinStrictRegex;
                } else {
                    return this._weekdaysMinRegex;
                }
            } else {
                if (!hasOwnProp(this, '_weekdaysMinRegex')) {
                    this._weekdaysMinRegex = defaultWeekdaysMinRegex;
                }
                return this._weekdaysMinStrictRegex && isStrict
                    ? this._weekdaysMinStrictRegex
                    : this._weekdaysMinRegex;
            }
        }

        function computeWeekdaysParse() {
            function cmpLenRev(a, b) {
                return b.length - a.length;
            }

            var minPieces = [],
                shortPieces = [],
                longPieces = [],
                mixedPieces = [],
                i,
                mom,
                minp,
                shortp,
                longp;
            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                mom = createUTC([2000, 1]).day(i);
                minp = regexEscape(this.weekdaysMin(mom, ''));
                shortp = regexEscape(this.weekdaysShort(mom, ''));
                longp = regexEscape(this.weekdays(mom, ''));
                minPieces.push(minp);
                shortPieces.push(shortp);
                longPieces.push(longp);
                mixedPieces.push(minp);
                mixedPieces.push(shortp);
                mixedPieces.push(longp);
            }
            // Sorting makes sure if one weekday (or abbr) is a prefix of another it
            // will match the longer piece.
            minPieces.sort(cmpLenRev);
            shortPieces.sort(cmpLenRev);
            longPieces.sort(cmpLenRev);
            mixedPieces.sort(cmpLenRev);

            this._weekdaysRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
            this._weekdaysShortRegex = this._weekdaysRegex;
            this._weekdaysMinRegex = this._weekdaysRegex;

            this._weekdaysStrictRegex = new RegExp(
                '^(' + longPieces.join('|') + ')',
                'i'
            );
            this._weekdaysShortStrictRegex = new RegExp(
                '^(' + shortPieces.join('|') + ')',
                'i'
            );
            this._weekdaysMinStrictRegex = new RegExp(
                '^(' + minPieces.join('|') + ')',
                'i'
            );
        }

        // FORMATTING

        function hFormat() {
            return this.hours() % 12 || 12;
        }

        function kFormat() {
            return this.hours() || 24;
        }

        addFormatToken('H', ['HH', 2], 0, 'hour');
        addFormatToken('h', ['hh', 2], 0, hFormat);
        addFormatToken('k', ['kk', 2], 0, kFormat);

        addFormatToken('hmm', 0, 0, function () {
            return '' + hFormat.apply(this) + zeroFill(this.minutes(), 2);
        });

        addFormatToken('hmmss', 0, 0, function () {
            return (
                '' +
                hFormat.apply(this) +
                zeroFill(this.minutes(), 2) +
                zeroFill(this.seconds(), 2)
            );
        });

        addFormatToken('Hmm', 0, 0, function () {
            return '' + this.hours() + zeroFill(this.minutes(), 2);
        });

        addFormatToken('Hmmss', 0, 0, function () {
            return (
                '' +
                this.hours() +
                zeroFill(this.minutes(), 2) +
                zeroFill(this.seconds(), 2)
            );
        });

        function meridiem(token, lowercase) {
            addFormatToken(token, 0, 0, function () {
                return this.localeData().meridiem(
                    this.hours(),
                    this.minutes(),
                    lowercase
                );
            });
        }

        meridiem('a', true);
        meridiem('A', false);

        // ALIASES

        addUnitAlias('hour', 'h');

        // PRIORITY
        addUnitPriority('hour', 13);

        // PARSING

        function matchMeridiem(isStrict, locale) {
            return locale._meridiemParse;
        }

        addRegexToken('a', matchMeridiem);
        addRegexToken('A', matchMeridiem);
        addRegexToken('H', match1to2);
        addRegexToken('h', match1to2);
        addRegexToken('k', match1to2);
        addRegexToken('HH', match1to2, match2);
        addRegexToken('hh', match1to2, match2);
        addRegexToken('kk', match1to2, match2);

        addRegexToken('hmm', match3to4);
        addRegexToken('hmmss', match5to6);
        addRegexToken('Hmm', match3to4);
        addRegexToken('Hmmss', match5to6);

        addParseToken(['H', 'HH'], HOUR);
        addParseToken(['k', 'kk'], function (input, array, config) {
            var kInput = toInt(input);
            array[HOUR] = kInput === 24 ? 0 : kInput;
        });
        addParseToken(['a', 'A'], function (input, array, config) {
            config._isPm = config._locale.isPM(input);
            config._meridiem = input;
        });
        addParseToken(['h', 'hh'], function (input, array, config) {
            array[HOUR] = toInt(input);
            getParsingFlags(config).bigHour = true;
        });
        addParseToken('hmm', function (input, array, config) {
            var pos = input.length - 2;
            array[HOUR] = toInt(input.substr(0, pos));
            array[MINUTE] = toInt(input.substr(pos));
            getParsingFlags(config).bigHour = true;
        });
        addParseToken('hmmss', function (input, array, config) {
            var pos1 = input.length - 4,
                pos2 = input.length - 2;
            array[HOUR] = toInt(input.substr(0, pos1));
            array[MINUTE] = toInt(input.substr(pos1, 2));
            array[SECOND] = toInt(input.substr(pos2));
            getParsingFlags(config).bigHour = true;
        });
        addParseToken('Hmm', function (input, array, config) {
            var pos = input.length - 2;
            array[HOUR] = toInt(input.substr(0, pos));
            array[MINUTE] = toInt(input.substr(pos));
        });
        addParseToken('Hmmss', function (input, array, config) {
            var pos1 = input.length - 4,
                pos2 = input.length - 2;
            array[HOUR] = toInt(input.substr(0, pos1));
            array[MINUTE] = toInt(input.substr(pos1, 2));
            array[SECOND] = toInt(input.substr(pos2));
        });

        // LOCALES

        function localeIsPM(input) {
            // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
            // Using charAt should be more compatible.
            return (input + '').toLowerCase().charAt(0) === 'p';
        }

        var defaultLocaleMeridiemParse = /[ap]\.?m?\.?/i,
            // Setting the hour should keep the time, because the user explicitly
            // specified which hour they want. So trying to maintain the same hour (in
            // a new timezone) makes sense. Adding/subtracting hours does not follow
            // this rule.
            getSetHour = makeGetSet('Hours', true);

        function localeMeridiem(hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        }

        var baseConfig = {
            calendar: defaultCalendar,
            longDateFormat: defaultLongDateFormat,
            invalidDate: defaultInvalidDate,
            ordinal: defaultOrdinal,
            dayOfMonthOrdinalParse: defaultDayOfMonthOrdinalParse,
            relativeTime: defaultRelativeTime,

            months: defaultLocaleMonths,
            monthsShort: defaultLocaleMonthsShort,

            week: defaultLocaleWeek,

            weekdays: defaultLocaleWeekdays,
            weekdaysMin: defaultLocaleWeekdaysMin,
            weekdaysShort: defaultLocaleWeekdaysShort,

            meridiemParse: defaultLocaleMeridiemParse,
        };

        // internal storage for locale config files
        var locales = {},
            localeFamilies = {},
            globalLocale;

        function commonPrefix(arr1, arr2) {
            var i,
                minl = Math.min(arr1.length, arr2.length);
            for (i = 0; i < minl; i += 1) {
                if (arr1[i] !== arr2[i]) {
                    return i;
                }
            }
            return minl;
        }

        function normalizeLocale(key) {
            return key ? key.toLowerCase().replace('_', '-') : key;
        }

        // pick the locale from the array
        // try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
        // substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
        function chooseLocale(names) {
            var i = 0,
                j,
                next,
                locale,
                split;

            while (i < names.length) {
                split = normalizeLocale(names[i]).split('-');
                j = split.length;
                next = normalizeLocale(names[i + 1]);
                next = next ? next.split('-') : null;
                while (j > 0) {
                    locale = loadLocale(split.slice(0, j).join('-'));
                    if (locale) {
                        return locale;
                    }
                    if (
                        next &&
                        next.length >= j &&
                        commonPrefix(split, next) >= j - 1
                    ) {
                        //the next array item is better than a shallower substring of this one
                        break;
                    }
                    j--;
                }
                i++;
            }
            return globalLocale;
        }

        function isLocaleNameSane(name) {
            // Prevent names that look like filesystem paths, i.e contain '/' or '\'
            return name.match('^[^/\\\\]*$') != null;
        }

        function loadLocale(name) {
            var oldLocale = null,
                aliasedRequire;
            // TODO: Find a better way to register and load all the locales in Node
            if (
                locales[name] === undefined &&
                'object' !== 'undefined' &&
                module &&
                module.exports &&
                isLocaleNameSane(name)
            ) {
                try {
                    oldLocale = globalLocale._abbr;
                    aliasedRequire = commonjsRequire;
                    aliasedRequire('./locale/' + name);
                    getSetGlobalLocale(oldLocale);
                } catch (e) {
                    // mark as not found to avoid repeating expensive file require call causing high CPU
                    // when trying to find en-US, en_US, en-us for every format call
                    locales[name] = null; // null means not found
                }
            }
            return locales[name];
        }

        // This function will load locale and then set the global locale.  If
        // no arguments are passed in, it will simply return the current global
        // locale key.
        function getSetGlobalLocale(key, values) {
            var data;
            if (key) {
                if (isUndefined(values)) {
                    data = getLocale(key);
                } else {
                    data = defineLocale(key, values);
                }

                if (data) {
                    // moment.duration._locale = moment._locale = data;
                    globalLocale = data;
                } else {
                    if (typeof console !== 'undefined' && console.warn) {
                        //warn user if arguments are passed but the locale could not be set
                        console.warn(
                            'Locale ' + key + ' not found. Did you forget to load it?'
                        );
                    }
                }
            }

            return globalLocale._abbr;
        }

        function defineLocale(name, config) {
            if (config !== null) {
                var locale,
                    parentConfig = baseConfig;
                config.abbr = name;
                if (locales[name] != null) {
                    deprecateSimple(
                        'defineLocaleOverride',
                        'use moment.updateLocale(localeName, config) to change ' +
                            'an existing locale. moment.defineLocale(localeName, ' +
                            'config) should only be used for creating a new locale ' +
                            'See http://momentjs.com/guides/#/warnings/define-locale/ for more info.'
                    );
                    parentConfig = locales[name]._config;
                } else if (config.parentLocale != null) {
                    if (locales[config.parentLocale] != null) {
                        parentConfig = locales[config.parentLocale]._config;
                    } else {
                        locale = loadLocale(config.parentLocale);
                        if (locale != null) {
                            parentConfig = locale._config;
                        } else {
                            if (!localeFamilies[config.parentLocale]) {
                                localeFamilies[config.parentLocale] = [];
                            }
                            localeFamilies[config.parentLocale].push({
                                name: name,
                                config: config,
                            });
                            return null;
                        }
                    }
                }
                locales[name] = new Locale(mergeConfigs(parentConfig, config));

                if (localeFamilies[name]) {
                    localeFamilies[name].forEach(function (x) {
                        defineLocale(x.name, x.config);
                    });
                }

                // backwards compat for now: also set the locale
                // make sure we set the locale AFTER all child locales have been
                // created, so we won't end up with the child locale set.
                getSetGlobalLocale(name);

                return locales[name];
            } else {
                // useful for testing
                delete locales[name];
                return null;
            }
        }

        function updateLocale(name, config) {
            if (config != null) {
                var locale,
                    tmpLocale,
                    parentConfig = baseConfig;

                if (locales[name] != null && locales[name].parentLocale != null) {
                    // Update existing child locale in-place to avoid memory-leaks
                    locales[name].set(mergeConfigs(locales[name]._config, config));
                } else {
                    // MERGE
                    tmpLocale = loadLocale(name);
                    if (tmpLocale != null) {
                        parentConfig = tmpLocale._config;
                    }
                    config = mergeConfigs(parentConfig, config);
                    if (tmpLocale == null) {
                        // updateLocale is called for creating a new locale
                        // Set abbr so it will have a name (getters return
                        // undefined otherwise).
                        config.abbr = name;
                    }
                    locale = new Locale(config);
                    locale.parentLocale = locales[name];
                    locales[name] = locale;
                }

                // backwards compat for now: also set the locale
                getSetGlobalLocale(name);
            } else {
                // pass null for config to unupdate, useful for tests
                if (locales[name] != null) {
                    if (locales[name].parentLocale != null) {
                        locales[name] = locales[name].parentLocale;
                        if (name === getSetGlobalLocale()) {
                            getSetGlobalLocale(name);
                        }
                    } else if (locales[name] != null) {
                        delete locales[name];
                    }
                }
            }
            return locales[name];
        }

        // returns locale data
        function getLocale(key) {
            var locale;

            if (key && key._locale && key._locale._abbr) {
                key = key._locale._abbr;
            }

            if (!key) {
                return globalLocale;
            }

            if (!isArray(key)) {
                //short-circuit everything else
                locale = loadLocale(key);
                if (locale) {
                    return locale;
                }
                key = [key];
            }

            return chooseLocale(key);
        }

        function listLocales() {
            return keys(locales);
        }

        function checkOverflow(m) {
            var overflow,
                a = m._a;

            if (a && getParsingFlags(m).overflow === -2) {
                overflow =
                    a[MONTH] < 0 || a[MONTH] > 11
                        ? MONTH
                        : a[DATE] < 1 || a[DATE] > daysInMonth(a[YEAR], a[MONTH])
                        ? DATE
                        : a[HOUR] < 0 ||
                          a[HOUR] > 24 ||
                          (a[HOUR] === 24 &&
                              (a[MINUTE] !== 0 ||
                                  a[SECOND] !== 0 ||
                                  a[MILLISECOND] !== 0))
                        ? HOUR
                        : a[MINUTE] < 0 || a[MINUTE] > 59
                        ? MINUTE
                        : a[SECOND] < 0 || a[SECOND] > 59
                        ? SECOND
                        : a[MILLISECOND] < 0 || a[MILLISECOND] > 999
                        ? MILLISECOND
                        : -1;

                if (
                    getParsingFlags(m)._overflowDayOfYear &&
                    (overflow < YEAR || overflow > DATE)
                ) {
                    overflow = DATE;
                }
                if (getParsingFlags(m)._overflowWeeks && overflow === -1) {
                    overflow = WEEK;
                }
                if (getParsingFlags(m)._overflowWeekday && overflow === -1) {
                    overflow = WEEKDAY;
                }

                getParsingFlags(m).overflow = overflow;
            }

            return m;
        }

        // iso 8601 regex
        // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
        var extendedIsoRegex =
                /^\s*((?:[+-]\d{6}|\d{4})-(?:\d\d-\d\d|W\d\d-\d|W\d\d|\d\d\d|\d\d))(?:(T| )(\d\d(?::\d\d(?::\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/,
            basicIsoRegex =
                /^\s*((?:[+-]\d{6}|\d{4})(?:\d\d\d\d|W\d\d\d|W\d\d|\d\d\d|\d\d|))(?:(T| )(\d\d(?:\d\d(?:\d\d(?:[.,]\d+)?)?)?)([+-]\d\d(?::?\d\d)?|\s*Z)?)?$/,
            tzRegex = /Z|[+-]\d\d(?::?\d\d)?/,
            isoDates = [
                ['YYYYYY-MM-DD', /[+-]\d{6}-\d\d-\d\d/],
                ['YYYY-MM-DD', /\d{4}-\d\d-\d\d/],
                ['GGGG-[W]WW-E', /\d{4}-W\d\d-\d/],
                ['GGGG-[W]WW', /\d{4}-W\d\d/, false],
                ['YYYY-DDD', /\d{4}-\d{3}/],
                ['YYYY-MM', /\d{4}-\d\d/, false],
                ['YYYYYYMMDD', /[+-]\d{10}/],
                ['YYYYMMDD', /\d{8}/],
                ['GGGG[W]WWE', /\d{4}W\d{3}/],
                ['GGGG[W]WW', /\d{4}W\d{2}/, false],
                ['YYYYDDD', /\d{7}/],
                ['YYYYMM', /\d{6}/, false],
                ['YYYY', /\d{4}/, false],
            ],
            // iso time formats and regexes
            isoTimes = [
                ['HH:mm:ss.SSSS', /\d\d:\d\d:\d\d\.\d+/],
                ['HH:mm:ss,SSSS', /\d\d:\d\d:\d\d,\d+/],
                ['HH:mm:ss', /\d\d:\d\d:\d\d/],
                ['HH:mm', /\d\d:\d\d/],
                ['HHmmss.SSSS', /\d\d\d\d\d\d\.\d+/],
                ['HHmmss,SSSS', /\d\d\d\d\d\d,\d+/],
                ['HHmmss', /\d\d\d\d\d\d/],
                ['HHmm', /\d\d\d\d/],
                ['HH', /\d\d/],
            ],
            aspNetJsonRegex = /^\/?Date\((-?\d+)/i,
            // RFC 2822 regex: For details see https://tools.ietf.org/html/rfc2822#section-3.3
            rfc2822 =
                /^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s)?(\d{1,2})\s(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s(\d{2,4})\s(\d\d):(\d\d)(?::(\d\d))?\s(?:(UT|GMT|[ECMP][SD]T)|([Zz])|([+-]\d{4}))$/,
            obsOffsets = {
                UT: 0,
                GMT: 0,
                EDT: -4 * 60,
                EST: -5 * 60,
                CDT: -5 * 60,
                CST: -6 * 60,
                MDT: -6 * 60,
                MST: -7 * 60,
                PDT: -7 * 60,
                PST: -8 * 60,
            };

        // date from iso format
        function configFromISO(config) {
            var i,
                l,
                string = config._i,
                match = extendedIsoRegex.exec(string) || basicIsoRegex.exec(string),
                allowTime,
                dateFormat,
                timeFormat,
                tzFormat,
                isoDatesLen = isoDates.length,
                isoTimesLen = isoTimes.length;

            if (match) {
                getParsingFlags(config).iso = true;
                for (i = 0, l = isoDatesLen; i < l; i++) {
                    if (isoDates[i][1].exec(match[1])) {
                        dateFormat = isoDates[i][0];
                        allowTime = isoDates[i][2] !== false;
                        break;
                    }
                }
                if (dateFormat == null) {
                    config._isValid = false;
                    return;
                }
                if (match[3]) {
                    for (i = 0, l = isoTimesLen; i < l; i++) {
                        if (isoTimes[i][1].exec(match[3])) {
                            // match[2] should be 'T' or space
                            timeFormat = (match[2] || ' ') + isoTimes[i][0];
                            break;
                        }
                    }
                    if (timeFormat == null) {
                        config._isValid = false;
                        return;
                    }
                }
                if (!allowTime && timeFormat != null) {
                    config._isValid = false;
                    return;
                }
                if (match[4]) {
                    if (tzRegex.exec(match[4])) {
                        tzFormat = 'Z';
                    } else {
                        config._isValid = false;
                        return;
                    }
                }
                config._f = dateFormat + (timeFormat || '') + (tzFormat || '');
                configFromStringAndFormat(config);
            } else {
                config._isValid = false;
            }
        }

        function extractFromRFC2822Strings(
            yearStr,
            monthStr,
            dayStr,
            hourStr,
            minuteStr,
            secondStr
        ) {
            var result = [
                untruncateYear(yearStr),
                defaultLocaleMonthsShort.indexOf(monthStr),
                parseInt(dayStr, 10),
                parseInt(hourStr, 10),
                parseInt(minuteStr, 10),
            ];

            if (secondStr) {
                result.push(parseInt(secondStr, 10));
            }

            return result;
        }

        function untruncateYear(yearStr) {
            var year = parseInt(yearStr, 10);
            if (year <= 49) {
                return 2000 + year;
            } else if (year <= 999) {
                return 1900 + year;
            }
            return year;
        }

        function preprocessRFC2822(s) {
            // Remove comments and folding whitespace and replace multiple-spaces with a single space
            return s
                .replace(/\([^)]*\)|[\n\t]/g, ' ')
                .replace(/(\s\s+)/g, ' ')
                .replace(/^\s\s*/, '')
                .replace(/\s\s*$/, '');
        }

        function checkWeekday(weekdayStr, parsedInput, config) {
            if (weekdayStr) {
                // TODO: Replace the vanilla JS Date object with an independent day-of-week check.
                var weekdayProvided = defaultLocaleWeekdaysShort.indexOf(weekdayStr),
                    weekdayActual = new Date(
                        parsedInput[0],
                        parsedInput[1],
                        parsedInput[2]
                    ).getDay();
                if (weekdayProvided !== weekdayActual) {
                    getParsingFlags(config).weekdayMismatch = true;
                    config._isValid = false;
                    return false;
                }
            }
            return true;
        }

        function calculateOffset(obsOffset, militaryOffset, numOffset) {
            if (obsOffset) {
                return obsOffsets[obsOffset];
            } else if (militaryOffset) {
                // the only allowed military tz is Z
                return 0;
            } else {
                var hm = parseInt(numOffset, 10),
                    m = hm % 100,
                    h = (hm - m) / 100;
                return h * 60 + m;
            }
        }

        // date and time from ref 2822 format
        function configFromRFC2822(config) {
            var match = rfc2822.exec(preprocessRFC2822(config._i)),
                parsedArray;
            if (match) {
                parsedArray = extractFromRFC2822Strings(
                    match[4],
                    match[3],
                    match[2],
                    match[5],
                    match[6],
                    match[7]
                );
                if (!checkWeekday(match[1], parsedArray, config)) {
                    return;
                }

                config._a = parsedArray;
                config._tzm = calculateOffset(match[8], match[9], match[10]);

                config._d = createUTCDate.apply(null, config._a);
                config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);

                getParsingFlags(config).rfc2822 = true;
            } else {
                config._isValid = false;
            }
        }

        // date from 1) ASP.NET, 2) ISO, 3) RFC 2822 formats, or 4) optional fallback if parsing isn't strict
        function configFromString(config) {
            var matched = aspNetJsonRegex.exec(config._i);
            if (matched !== null) {
                config._d = new Date(+matched[1]);
                return;
            }

            configFromISO(config);
            if (config._isValid === false) {
                delete config._isValid;
            } else {
                return;
            }

            configFromRFC2822(config);
            if (config._isValid === false) {
                delete config._isValid;
            } else {
                return;
            }

            if (config._strict) {
                config._isValid = false;
            } else {
                // Final attempt, use Input Fallback
                hooks.createFromInputFallback(config);
            }
        }

        hooks.createFromInputFallback = deprecate(
            'value provided is not in a recognized RFC2822 or ISO format. moment construction falls back to js Date(), ' +
                'which is not reliable across all browsers and versions. Non RFC2822/ISO date formats are ' +
                'discouraged. Please refer to http://momentjs.com/guides/#/warnings/js-date/ for more info.',
            function (config) {
                config._d = new Date(config._i + (config._useUTC ? ' UTC' : ''));
            }
        );

        // Pick the first defined of two or three arguments.
        function defaults(a, b, c) {
            if (a != null) {
                return a;
            }
            if (b != null) {
                return b;
            }
            return c;
        }

        function currentDateArray(config) {
            // hooks is actually the exported moment object
            var nowValue = new Date(hooks.now());
            if (config._useUTC) {
                return [
                    nowValue.getUTCFullYear(),
                    nowValue.getUTCMonth(),
                    nowValue.getUTCDate(),
                ];
            }
            return [nowValue.getFullYear(), nowValue.getMonth(), nowValue.getDate()];
        }

        // convert an array to a date.
        // the array should mirror the parameters below
        // note: all values past the year are optional and will default to the lowest possible value.
        // [year, month, day , hour, minute, second, millisecond]
        function configFromArray(config) {
            var i,
                date,
                input = [],
                currentDate,
                expectedWeekday,
                yearToUse;

            if (config._d) {
                return;
            }

            currentDate = currentDateArray(config);

            //compute day of the year from weeks and weekdays
            if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
                dayOfYearFromWeekInfo(config);
            }

            //if the day of the year is set, figure out what it is
            if (config._dayOfYear != null) {
                yearToUse = defaults(config._a[YEAR], currentDate[YEAR]);

                if (
                    config._dayOfYear > daysInYear(yearToUse) ||
                    config._dayOfYear === 0
                ) {
                    getParsingFlags(config)._overflowDayOfYear = true;
                }

                date = createUTCDate(yearToUse, 0, config._dayOfYear);
                config._a[MONTH] = date.getUTCMonth();
                config._a[DATE] = date.getUTCDate();
            }

            // Default to current date.
            // * if no year, month, day of month are given, default to today
            // * if day of month is given, default month and year
            // * if month is given, default only year
            // * if year is given, don't default anything
            for (i = 0; i < 3 && config._a[i] == null; ++i) {
                config._a[i] = input[i] = currentDate[i];
            }

            // Zero out whatever was not defaulted, including time
            for (; i < 7; i++) {
                config._a[i] = input[i] =
                    config._a[i] == null ? (i === 2 ? 1 : 0) : config._a[i];
            }

            // Check for 24:00:00.000
            if (
                config._a[HOUR] === 24 &&
                config._a[MINUTE] === 0 &&
                config._a[SECOND] === 0 &&
                config._a[MILLISECOND] === 0
            ) {
                config._nextDay = true;
                config._a[HOUR] = 0;
            }

            config._d = (config._useUTC ? createUTCDate : createDate).apply(
                null,
                input
            );
            expectedWeekday = config._useUTC
                ? config._d.getUTCDay()
                : config._d.getDay();

            // Apply timezone offset from input. The actual utcOffset can be changed
            // with parseZone.
            if (config._tzm != null) {
                config._d.setUTCMinutes(config._d.getUTCMinutes() - config._tzm);
            }

            if (config._nextDay) {
                config._a[HOUR] = 24;
            }

            // check for mismatching day of week
            if (
                config._w &&
                typeof config._w.d !== 'undefined' &&
                config._w.d !== expectedWeekday
            ) {
                getParsingFlags(config).weekdayMismatch = true;
            }
        }

        function dayOfYearFromWeekInfo(config) {
            var w, weekYear, week, weekday, dow, doy, temp, weekdayOverflow, curWeek;

            w = config._w;
            if (w.GG != null || w.W != null || w.E != null) {
                dow = 1;
                doy = 4;

                // TODO: We need to take the current isoWeekYear, but that depends on
                // how we interpret now (local, utc, fixed offset). So create
                // a now version of current config (take local/utc/offset flags, and
                // create now).
                weekYear = defaults(
                    w.GG,
                    config._a[YEAR],
                    weekOfYear(createLocal(), 1, 4).year
                );
                week = defaults(w.W, 1);
                weekday = defaults(w.E, 1);
                if (weekday < 1 || weekday > 7) {
                    weekdayOverflow = true;
                }
            } else {
                dow = config._locale._week.dow;
                doy = config._locale._week.doy;

                curWeek = weekOfYear(createLocal(), dow, doy);

                weekYear = defaults(w.gg, config._a[YEAR], curWeek.year);

                // Default to current week.
                week = defaults(w.w, curWeek.week);

                if (w.d != null) {
                    // weekday -- low day numbers are considered next week
                    weekday = w.d;
                    if (weekday < 0 || weekday > 6) {
                        weekdayOverflow = true;
                    }
                } else if (w.e != null) {
                    // local weekday -- counting starts from beginning of week
                    weekday = w.e + dow;
                    if (w.e < 0 || w.e > 6) {
                        weekdayOverflow = true;
                    }
                } else {
                    // default to beginning of week
                    weekday = dow;
                }
            }
            if (week < 1 || week > weeksInYear(weekYear, dow, doy)) {
                getParsingFlags(config)._overflowWeeks = true;
            } else if (weekdayOverflow != null) {
                getParsingFlags(config)._overflowWeekday = true;
            } else {
                temp = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy);
                config._a[YEAR] = temp.year;
                config._dayOfYear = temp.dayOfYear;
            }
        }

        // constant that refers to the ISO standard
        hooks.ISO_8601 = function () {};

        // constant that refers to the RFC 2822 form
        hooks.RFC_2822 = function () {};

        // date from string and format string
        function configFromStringAndFormat(config) {
            // TODO: Move this to another part of the creation flow to prevent circular deps
            if (config._f === hooks.ISO_8601) {
                configFromISO(config);
                return;
            }
            if (config._f === hooks.RFC_2822) {
                configFromRFC2822(config);
                return;
            }
            config._a = [];
            getParsingFlags(config).empty = true;

            // This array is used to make a Date, either with `new Date` or `Date.UTC`
            var string = '' + config._i,
                i,
                parsedInput,
                tokens,
                token,
                skipped,
                stringLength = string.length,
                totalParsedInputLength = 0,
                era,
                tokenLen;

            tokens =
                expandFormat(config._f, config._locale).match(formattingTokens) || [];
            tokenLen = tokens.length;
            for (i = 0; i < tokenLen; i++) {
                token = tokens[i];
                parsedInput = (string.match(getParseRegexForToken(token, config)) ||
                    [])[0];
                if (parsedInput) {
                    skipped = string.substr(0, string.indexOf(parsedInput));
                    if (skipped.length > 0) {
                        getParsingFlags(config).unusedInput.push(skipped);
                    }
                    string = string.slice(
                        string.indexOf(parsedInput) + parsedInput.length
                    );
                    totalParsedInputLength += parsedInput.length;
                }
                // don't parse if it's not a known token
                if (formatTokenFunctions[token]) {
                    if (parsedInput) {
                        getParsingFlags(config).empty = false;
                    } else {
                        getParsingFlags(config).unusedTokens.push(token);
                    }
                    addTimeToArrayFromToken(token, parsedInput, config);
                } else if (config._strict && !parsedInput) {
                    getParsingFlags(config).unusedTokens.push(token);
                }
            }

            // add remaining unparsed input length to the string
            getParsingFlags(config).charsLeftOver =
                stringLength - totalParsedInputLength;
            if (string.length > 0) {
                getParsingFlags(config).unusedInput.push(string);
            }

            // clear _12h flag if hour is <= 12
            if (
                config._a[HOUR] <= 12 &&
                getParsingFlags(config).bigHour === true &&
                config._a[HOUR] > 0
            ) {
                getParsingFlags(config).bigHour = undefined;
            }

            getParsingFlags(config).parsedDateParts = config._a.slice(0);
            getParsingFlags(config).meridiem = config._meridiem;
            // handle meridiem
            config._a[HOUR] = meridiemFixWrap(
                config._locale,
                config._a[HOUR],
                config._meridiem
            );

            // handle era
            era = getParsingFlags(config).era;
            if (era !== null) {
                config._a[YEAR] = config._locale.erasConvertYear(era, config._a[YEAR]);
            }

            configFromArray(config);
            checkOverflow(config);
        }

        function meridiemFixWrap(locale, hour, meridiem) {
            var isPm;

            if (meridiem == null) {
                // nothing to do
                return hour;
            }
            if (locale.meridiemHour != null) {
                return locale.meridiemHour(hour, meridiem);
            } else if (locale.isPM != null) {
                // Fallback
                isPm = locale.isPM(meridiem);
                if (isPm && hour < 12) {
                    hour += 12;
                }
                if (!isPm && hour === 12) {
                    hour = 0;
                }
                return hour;
            } else {
                // this is not supposed to happen
                return hour;
            }
        }

        // date from string and array of format strings
        function configFromStringAndArray(config) {
            var tempConfig,
                bestMoment,
                scoreToBeat,
                i,
                currentScore,
                validFormatFound,
                bestFormatIsValid = false,
                configfLen = config._f.length;

            if (configfLen === 0) {
                getParsingFlags(config).invalidFormat = true;
                config._d = new Date(NaN);
                return;
            }

            for (i = 0; i < configfLen; i++) {
                currentScore = 0;
                validFormatFound = false;
                tempConfig = copyConfig({}, config);
                if (config._useUTC != null) {
                    tempConfig._useUTC = config._useUTC;
                }
                tempConfig._f = config._f[i];
                configFromStringAndFormat(tempConfig);

                if (isValid(tempConfig)) {
                    validFormatFound = true;
                }

                // if there is any input that was not parsed add a penalty for that format
                currentScore += getParsingFlags(tempConfig).charsLeftOver;

                //or tokens
                currentScore += getParsingFlags(tempConfig).unusedTokens.length * 10;

                getParsingFlags(tempConfig).score = currentScore;

                if (!bestFormatIsValid) {
                    if (
                        scoreToBeat == null ||
                        currentScore < scoreToBeat ||
                        validFormatFound
                    ) {
                        scoreToBeat = currentScore;
                        bestMoment = tempConfig;
                        if (validFormatFound) {
                            bestFormatIsValid = true;
                        }
                    }
                } else {
                    if (currentScore < scoreToBeat) {
                        scoreToBeat = currentScore;
                        bestMoment = tempConfig;
                    }
                }
            }

            extend(config, bestMoment || tempConfig);
        }

        function configFromObject(config) {
            if (config._d) {
                return;
            }

            var i = normalizeObjectUnits(config._i),
                dayOrDate = i.day === undefined ? i.date : i.day;
            config._a = map(
                [i.year, i.month, dayOrDate, i.hour, i.minute, i.second, i.millisecond],
                function (obj) {
                    return obj && parseInt(obj, 10);
                }
            );

            configFromArray(config);
        }

        function createFromConfig(config) {
            var res = new Moment(checkOverflow(prepareConfig(config)));
            if (res._nextDay) {
                // Adding is smart enough around DST
                res.add(1, 'd');
                res._nextDay = undefined;
            }

            return res;
        }

        function prepareConfig(config) {
            var input = config._i,
                format = config._f;

            config._locale = config._locale || getLocale(config._l);

            if (input === null || (format === undefined && input === '')) {
                return createInvalid({ nullInput: true });
            }

            if (typeof input === 'string') {
                config._i = input = config._locale.preparse(input);
            }

            if (isMoment(input)) {
                return new Moment(checkOverflow(input));
            } else if (isDate(input)) {
                config._d = input;
            } else if (isArray(format)) {
                configFromStringAndArray(config);
            } else if (format) {
                configFromStringAndFormat(config);
            } else {
                configFromInput(config);
            }

            if (!isValid(config)) {
                config._d = null;
            }

            return config;
        }

        function configFromInput(config) {
            var input = config._i;
            if (isUndefined(input)) {
                config._d = new Date(hooks.now());
            } else if (isDate(input)) {
                config._d = new Date(input.valueOf());
            } else if (typeof input === 'string') {
                configFromString(config);
            } else if (isArray(input)) {
                config._a = map(input.slice(0), function (obj) {
                    return parseInt(obj, 10);
                });
                configFromArray(config);
            } else if (isObject(input)) {
                configFromObject(config);
            } else if (isNumber(input)) {
                // from milliseconds
                config._d = new Date(input);
            } else {
                hooks.createFromInputFallback(config);
            }
        }

        function createLocalOrUTC(input, format, locale, strict, isUTC) {
            var c = {};

            if (format === true || format === false) {
                strict = format;
                format = undefined;
            }

            if (locale === true || locale === false) {
                strict = locale;
                locale = undefined;
            }

            if (
                (isObject(input) && isObjectEmpty(input)) ||
                (isArray(input) && input.length === 0)
            ) {
                input = undefined;
            }
            // object construction must be done this way.
            // https://github.com/moment/moment/issues/1423
            c._isAMomentObject = true;
            c._useUTC = c._isUTC = isUTC;
            c._l = locale;
            c._i = input;
            c._f = format;
            c._strict = strict;

            return createFromConfig(c);
        }

        function createLocal(input, format, locale, strict) {
            return createLocalOrUTC(input, format, locale, strict, false);
        }

        var prototypeMin = deprecate(
                'moment().min is deprecated, use moment.max instead. http://momentjs.com/guides/#/warnings/min-max/',
                function () {
                    var other = createLocal.apply(null, arguments);
                    if (this.isValid() && other.isValid()) {
                        return other < this ? this : other;
                    } else {
                        return createInvalid();
                    }
                }
            ),
            prototypeMax = deprecate(
                'moment().max is deprecated, use moment.min instead. http://momentjs.com/guides/#/warnings/min-max/',
                function () {
                    var other = createLocal.apply(null, arguments);
                    if (this.isValid() && other.isValid()) {
                        return other > this ? this : other;
                    } else {
                        return createInvalid();
                    }
                }
            );

        // Pick a moment m from moments so that m[fn](other) is true for all
        // other. This relies on the function fn to be transitive.
        //
        // moments should either be an array of moment objects or an array, whose
        // first element is an array of moment objects.
        function pickBy(fn, moments) {
            var res, i;
            if (moments.length === 1 && isArray(moments[0])) {
                moments = moments[0];
            }
            if (!moments.length) {
                return createLocal();
            }
            res = moments[0];
            for (i = 1; i < moments.length; ++i) {
                if (!moments[i].isValid() || moments[i][fn](res)) {
                    res = moments[i];
                }
            }
            return res;
        }

        // TODO: Use [].sort instead?
        function min() {
            var args = [].slice.call(arguments, 0);

            return pickBy('isBefore', args);
        }

        function max() {
            var args = [].slice.call(arguments, 0);

            return pickBy('isAfter', args);
        }

        var now = function () {
            return Date.now ? Date.now() : +new Date();
        };

        var ordering = [
            'year',
            'quarter',
            'month',
            'week',
            'day',
            'hour',
            'minute',
            'second',
            'millisecond',
        ];

        function isDurationValid(m) {
            var key,
                unitHasDecimal = false,
                i,
                orderLen = ordering.length;
            for (key in m) {
                if (
                    hasOwnProp(m, key) &&
                    !(
                        indexOf.call(ordering, key) !== -1 &&
                        (m[key] == null || !isNaN(m[key]))
                    )
                ) {
                    return false;
                }
            }

            for (i = 0; i < orderLen; ++i) {
                if (m[ordering[i]]) {
                    if (unitHasDecimal) {
                        return false; // only allow non-integers for smallest unit
                    }
                    if (parseFloat(m[ordering[i]]) !== toInt(m[ordering[i]])) {
                        unitHasDecimal = true;
                    }
                }
            }

            return true;
        }

        function isValid$1() {
            return this._isValid;
        }

        function createInvalid$1() {
            return createDuration(NaN);
        }

        function Duration(duration) {
            var normalizedInput = normalizeObjectUnits(duration),
                years = normalizedInput.year || 0,
                quarters = normalizedInput.quarter || 0,
                months = normalizedInput.month || 0,
                weeks = normalizedInput.week || normalizedInput.isoWeek || 0,
                days = normalizedInput.day || 0,
                hours = normalizedInput.hour || 0,
                minutes = normalizedInput.minute || 0,
                seconds = normalizedInput.second || 0,
                milliseconds = normalizedInput.millisecond || 0;

            this._isValid = isDurationValid(normalizedInput);

            // representation for dateAddRemove
            this._milliseconds =
                +milliseconds +
                seconds * 1e3 + // 1000
                minutes * 6e4 + // 1000 * 60
                hours * 1000 * 60 * 60; //using 1000 * 60 * 60 instead of 36e5 to avoid floating point rounding errors https://github.com/moment/moment/issues/2978
            // Because of dateAddRemove treats 24 hours as different from a
            // day when working around DST, we need to store them separately
            this._days = +days + weeks * 7;
            // It is impossible to translate months into days without knowing
            // which months you are are talking about, so we have to store
            // it separately.
            this._months = +months + quarters * 3 + years * 12;

            this._data = {};

            this._locale = getLocale();

            this._bubble();
        }

        function isDuration(obj) {
            return obj instanceof Duration;
        }

        function absRound(number) {
            if (number < 0) {
                return Math.round(-1 * number) * -1;
            } else {
                return Math.round(number);
            }
        }

        // compare two arrays, return the number of differences
        function compareArrays(array1, array2, dontConvert) {
            var len = Math.min(array1.length, array2.length),
                lengthDiff = Math.abs(array1.length - array2.length),
                diffs = 0,
                i;
            for (i = 0; i < len; i++) {
                if (
                    (dontConvert && array1[i] !== array2[i]) ||
                    (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))
                ) {
                    diffs++;
                }
            }
            return diffs + lengthDiff;
        }

        // FORMATTING

        function offset(token, separator) {
            addFormatToken(token, 0, 0, function () {
                var offset = this.utcOffset(),
                    sign = '+';
                if (offset < 0) {
                    offset = -offset;
                    sign = '-';
                }
                return (
                    sign +
                    zeroFill(~~(offset / 60), 2) +
                    separator +
                    zeroFill(~~offset % 60, 2)
                );
            });
        }

        offset('Z', ':');
        offset('ZZ', '');

        // PARSING

        addRegexToken('Z', matchShortOffset);
        addRegexToken('ZZ', matchShortOffset);
        addParseToken(['Z', 'ZZ'], function (input, array, config) {
            config._useUTC = true;
            config._tzm = offsetFromString(matchShortOffset, input);
        });

        // HELPERS

        // timezone chunker
        // '+10:00' > ['10',  '00']
        // '-1530'  > ['-15', '30']
        var chunkOffset = /([\+\-]|\d\d)/gi;

        function offsetFromString(matcher, string) {
            var matches = (string || '').match(matcher),
                chunk,
                parts,
                minutes;

            if (matches === null) {
                return null;
            }

            chunk = matches[matches.length - 1] || [];
            parts = (chunk + '').match(chunkOffset) || ['-', 0, 0];
            minutes = +(parts[1] * 60) + toInt(parts[2]);

            return minutes === 0 ? 0 : parts[0] === '+' ? minutes : -minutes;
        }

        // Return a moment from input, that is local/utc/zone equivalent to model.
        function cloneWithOffset(input, model) {
            var res, diff;
            if (model._isUTC) {
                res = model.clone();
                diff =
                    (isMoment(input) || isDate(input)
                        ? input.valueOf()
                        : createLocal(input).valueOf()) - res.valueOf();
                // Use low-level api, because this fn is low-level api.
                res._d.setTime(res._d.valueOf() + diff);
                hooks.updateOffset(res, false);
                return res;
            } else {
                return createLocal(input).local();
            }
        }

        function getDateOffset(m) {
            // On Firefox.24 Date#getTimezoneOffset returns a floating point.
            // https://github.com/moment/moment/pull/1871
            return -Math.round(m._d.getTimezoneOffset());
        }

        // HOOKS

        // This function will be called whenever a moment is mutated.
        // It is intended to keep the offset in sync with the timezone.
        hooks.updateOffset = function () {};

        // MOMENTS

        // keepLocalTime = true means only change the timezone, without
        // affecting the local hour. So 5:31:26 +0300 --[utcOffset(2, true)]-->
        // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist with offset
        // +0200, so we adjust the time as needed, to be valid.
        //
        // Keeping the time actually adds/subtracts (one hour)
        // from the actual represented time. That is why we call updateOffset
        // a second time. In case it wants us to change the offset again
        // _changeInProgress == true case, then we have to adjust, because
        // there is no such time in the given timezone.
        function getSetOffset(input, keepLocalTime, keepMinutes) {
            var offset = this._offset || 0,
                localAdjust;
            if (!this.isValid()) {
                return input != null ? this : NaN;
            }
            if (input != null) {
                if (typeof input === 'string') {
                    input = offsetFromString(matchShortOffset, input);
                    if (input === null) {
                        return this;
                    }
                } else if (Math.abs(input) < 16 && !keepMinutes) {
                    input = input * 60;
                }
                if (!this._isUTC && keepLocalTime) {
                    localAdjust = getDateOffset(this);
                }
                this._offset = input;
                this._isUTC = true;
                if (localAdjust != null) {
                    this.add(localAdjust, 'm');
                }
                if (offset !== input) {
                    if (!keepLocalTime || this._changeInProgress) {
                        addSubtract(
                            this,
                            createDuration(input - offset, 'm'),
                            1,
                            false
                        );
                    } else if (!this._changeInProgress) {
                        this._changeInProgress = true;
                        hooks.updateOffset(this, true);
                        this._changeInProgress = null;
                    }
                }
                return this;
            } else {
                return this._isUTC ? offset : getDateOffset(this);
            }
        }

        function getSetZone(input, keepLocalTime) {
            if (input != null) {
                if (typeof input !== 'string') {
                    input = -input;
                }

                this.utcOffset(input, keepLocalTime);

                return this;
            } else {
                return -this.utcOffset();
            }
        }

        function setOffsetToUTC(keepLocalTime) {
            return this.utcOffset(0, keepLocalTime);
        }

        function setOffsetToLocal(keepLocalTime) {
            if (this._isUTC) {
                this.utcOffset(0, keepLocalTime);
                this._isUTC = false;

                if (keepLocalTime) {
                    this.subtract(getDateOffset(this), 'm');
                }
            }
            return this;
        }

        function setOffsetToParsedOffset() {
            if (this._tzm != null) {
                this.utcOffset(this._tzm, false, true);
            } else if (typeof this._i === 'string') {
                var tZone = offsetFromString(matchOffset, this._i);
                if (tZone != null) {
                    this.utcOffset(tZone);
                } else {
                    this.utcOffset(0, true);
                }
            }
            return this;
        }

        function hasAlignedHourOffset(input) {
            if (!this.isValid()) {
                return false;
            }
            input = input ? createLocal(input).utcOffset() : 0;

            return (this.utcOffset() - input) % 60 === 0;
        }

        function isDaylightSavingTime() {
            return (
                this.utcOffset() > this.clone().month(0).utcOffset() ||
                this.utcOffset() > this.clone().month(5).utcOffset()
            );
        }

        function isDaylightSavingTimeShifted() {
            if (!isUndefined(this._isDSTShifted)) {
                return this._isDSTShifted;
            }

            var c = {},
                other;

            copyConfig(c, this);
            c = prepareConfig(c);

            if (c._a) {
                other = c._isUTC ? createUTC(c._a) : createLocal(c._a);
                this._isDSTShifted =
                    this.isValid() && compareArrays(c._a, other.toArray()) > 0;
            } else {
                this._isDSTShifted = false;
            }

            return this._isDSTShifted;
        }

        function isLocal() {
            return this.isValid() ? !this._isUTC : false;
        }

        function isUtcOffset() {
            return this.isValid() ? this._isUTC : false;
        }

        function isUtc() {
            return this.isValid() ? this._isUTC && this._offset === 0 : false;
        }

        // ASP.NET json date format regex
        var aspNetRegex = /^(-|\+)?(?:(\d*)[. ])?(\d+):(\d+)(?::(\d+)(\.\d*)?)?$/,
            // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
            // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
            // and further modified to allow for strings containing both week and day
            isoRegex =
                /^(-|\+)?P(?:([-+]?[0-9,.]*)Y)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)W)?(?:([-+]?[0-9,.]*)D)?(?:T(?:([-+]?[0-9,.]*)H)?(?:([-+]?[0-9,.]*)M)?(?:([-+]?[0-9,.]*)S)?)?$/;

        function createDuration(input, key) {
            var duration = input,
                // matching against regexp is expensive, do it on demand
                match = null,
                sign,
                ret,
                diffRes;

            if (isDuration(input)) {
                duration = {
                    ms: input._milliseconds,
                    d: input._days,
                    M: input._months,
                };
            } else if (isNumber(input) || !isNaN(+input)) {
                duration = {};
                if (key) {
                    duration[key] = +input;
                } else {
                    duration.milliseconds = +input;
                }
            } else if ((match = aspNetRegex.exec(input))) {
                sign = match[1] === '-' ? -1 : 1;
                duration = {
                    y: 0,
                    d: toInt(match[DATE]) * sign,
                    h: toInt(match[HOUR]) * sign,
                    m: toInt(match[MINUTE]) * sign,
                    s: toInt(match[SECOND]) * sign,
                    ms: toInt(absRound(match[MILLISECOND] * 1000)) * sign, // the millisecond decimal point is included in the match
                };
            } else if ((match = isoRegex.exec(input))) {
                sign = match[1] === '-' ? -1 : 1;
                duration = {
                    y: parseIso(match[2], sign),
                    M: parseIso(match[3], sign),
                    w: parseIso(match[4], sign),
                    d: parseIso(match[5], sign),
                    h: parseIso(match[6], sign),
                    m: parseIso(match[7], sign),
                    s: parseIso(match[8], sign),
                };
            } else if (duration == null) {
                // checks for null or undefined
                duration = {};
            } else if (
                typeof duration === 'object' &&
                ('from' in duration || 'to' in duration)
            ) {
                diffRes = momentsDifference(
                    createLocal(duration.from),
                    createLocal(duration.to)
                );

                duration = {};
                duration.ms = diffRes.milliseconds;
                duration.M = diffRes.months;
            }

            ret = new Duration(duration);

            if (isDuration(input) && hasOwnProp(input, '_locale')) {
                ret._locale = input._locale;
            }

            if (isDuration(input) && hasOwnProp(input, '_isValid')) {
                ret._isValid = input._isValid;
            }

            return ret;
        }

        createDuration.fn = Duration.prototype;
        createDuration.invalid = createInvalid$1;

        function parseIso(inp, sign) {
            // We'd normally use ~~inp for this, but unfortunately it also
            // converts floats to ints.
            // inp may be undefined, so careful calling replace on it.
            var res = inp && parseFloat(inp.replace(',', '.'));
            // apply sign while we're at it
            return (isNaN(res) ? 0 : res) * sign;
        }

        function positiveMomentsDifference(base, other) {
            var res = {};

            res.months =
                other.month() - base.month() + (other.year() - base.year()) * 12;
            if (base.clone().add(res.months, 'M').isAfter(other)) {
                --res.months;
            }

            res.milliseconds = +other - +base.clone().add(res.months, 'M');

            return res;
        }

        function momentsDifference(base, other) {
            var res;
            if (!(base.isValid() && other.isValid())) {
                return { milliseconds: 0, months: 0 };
            }

            other = cloneWithOffset(other, base);
            if (base.isBefore(other)) {
                res = positiveMomentsDifference(base, other);
            } else {
                res = positiveMomentsDifference(other, base);
                res.milliseconds = -res.milliseconds;
                res.months = -res.months;
            }

            return res;
        }

        // TODO: remove 'name' arg after deprecation is removed
        function createAdder(direction, name) {
            return function (val, period) {
                var dur, tmp;
                //invert the arguments, but complain about it
                if (period !== null && !isNaN(+period)) {
                    deprecateSimple(
                        name,
                        'moment().' +
                            name +
                            '(period, number) is deprecated. Please use moment().' +
                            name +
                            '(number, period). ' +
                            'See http://momentjs.com/guides/#/warnings/add-inverted-param/ for more info.'
                    );
                    tmp = val;
                    val = period;
                    period = tmp;
                }

                dur = createDuration(val, period);
                addSubtract(this, dur, direction);
                return this;
            };
        }

        function addSubtract(mom, duration, isAdding, updateOffset) {
            var milliseconds = duration._milliseconds,
                days = absRound(duration._days),
                months = absRound(duration._months);

            if (!mom.isValid()) {
                // No op
                return;
            }

            updateOffset = updateOffset == null ? true : updateOffset;

            if (months) {
                setMonth(mom, get(mom, 'Month') + months * isAdding);
            }
            if (days) {
                set$1(mom, 'Date', get(mom, 'Date') + days * isAdding);
            }
            if (milliseconds) {
                mom._d.setTime(mom._d.valueOf() + milliseconds * isAdding);
            }
            if (updateOffset) {
                hooks.updateOffset(mom, days || months);
            }
        }

        var add = createAdder(1, 'add'),
            subtract = createAdder(-1, 'subtract');

        function isString(input) {
            return typeof input === 'string' || input instanceof String;
        }

        // type MomentInput = Moment | Date | string | number | (number | string)[] | MomentInputObject | void; // null | undefined
        function isMomentInput(input) {
            return (
                isMoment(input) ||
                isDate(input) ||
                isString(input) ||
                isNumber(input) ||
                isNumberOrStringArray(input) ||
                isMomentInputObject(input) ||
                input === null ||
                input === undefined
            );
        }

        function isMomentInputObject(input) {
            var objectTest = isObject(input) && !isObjectEmpty(input),
                propertyTest = false,
                properties = [
                    'years',
                    'year',
                    'y',
                    'months',
                    'month',
                    'M',
                    'days',
                    'day',
                    'd',
                    'dates',
                    'date',
                    'D',
                    'hours',
                    'hour',
                    'h',
                    'minutes',
                    'minute',
                    'm',
                    'seconds',
                    'second',
                    's',
                    'milliseconds',
                    'millisecond',
                    'ms',
                ],
                i,
                property,
                propertyLen = properties.length;

            for (i = 0; i < propertyLen; i += 1) {
                property = properties[i];
                propertyTest = propertyTest || hasOwnProp(input, property);
            }

            return objectTest && propertyTest;
        }

        function isNumberOrStringArray(input) {
            var arrayTest = isArray(input),
                dataTypeTest = false;
            if (arrayTest) {
                dataTypeTest =
                    input.filter(function (item) {
                        return !isNumber(item) && isString(input);
                    }).length === 0;
            }
            return arrayTest && dataTypeTest;
        }

        function isCalendarSpec(input) {
            var objectTest = isObject(input) && !isObjectEmpty(input),
                propertyTest = false,
                properties = [
                    'sameDay',
                    'nextDay',
                    'lastDay',
                    'nextWeek',
                    'lastWeek',
                    'sameElse',
                ],
                i,
                property;

            for (i = 0; i < properties.length; i += 1) {
                property = properties[i];
                propertyTest = propertyTest || hasOwnProp(input, property);
            }

            return objectTest && propertyTest;
        }

        function getCalendarFormat(myMoment, now) {
            var diff = myMoment.diff(now, 'days', true);
            return diff < -6
                ? 'sameElse'
                : diff < -1
                ? 'lastWeek'
                : diff < 0
                ? 'lastDay'
                : diff < 1
                ? 'sameDay'
                : diff < 2
                ? 'nextDay'
                : diff < 7
                ? 'nextWeek'
                : 'sameElse';
        }

        function calendar$1(time, formats) {
            // Support for single parameter, formats only overload to the calendar function
            if (arguments.length === 1) {
                if (!arguments[0]) {
                    time = undefined;
                    formats = undefined;
                } else if (isMomentInput(arguments[0])) {
                    time = arguments[0];
                    formats = undefined;
                } else if (isCalendarSpec(arguments[0])) {
                    formats = arguments[0];
                    time = undefined;
                }
            }
            // We want to compare the start of today, vs this.
            // Getting start-of-today depends on whether we're local/utc/offset or not.
            var now = time || createLocal(),
                sod = cloneWithOffset(now, this).startOf('day'),
                format = hooks.calendarFormat(this, sod) || 'sameElse',
                output =
                    formats &&
                    (isFunction(formats[format])
                        ? formats[format].call(this, now)
                        : formats[format]);

            return this.format(
                output || this.localeData().calendar(format, this, createLocal(now))
            );
        }

        function clone() {
            return new Moment(this);
        }

        function isAfter(input, units) {
            var localInput = isMoment(input) ? input : createLocal(input);
            if (!(this.isValid() && localInput.isValid())) {
                return false;
            }
            units = normalizeUnits(units) || 'millisecond';
            if (units === 'millisecond') {
                return this.valueOf() > localInput.valueOf();
            } else {
                return localInput.valueOf() < this.clone().startOf(units).valueOf();
            }
        }

        function isBefore(input, units) {
            var localInput = isMoment(input) ? input : createLocal(input);
            if (!(this.isValid() && localInput.isValid())) {
                return false;
            }
            units = normalizeUnits(units) || 'millisecond';
            if (units === 'millisecond') {
                return this.valueOf() < localInput.valueOf();
            } else {
                return this.clone().endOf(units).valueOf() < localInput.valueOf();
            }
        }

        function isBetween(from, to, units, inclusivity) {
            var localFrom = isMoment(from) ? from : createLocal(from),
                localTo = isMoment(to) ? to : createLocal(to);
            if (!(this.isValid() && localFrom.isValid() && localTo.isValid())) {
                return false;
            }
            inclusivity = inclusivity || '()';
            return (
                (inclusivity[0] === '('
                    ? this.isAfter(localFrom, units)
                    : !this.isBefore(localFrom, units)) &&
                (inclusivity[1] === ')'
                    ? this.isBefore(localTo, units)
                    : !this.isAfter(localTo, units))
            );
        }

        function isSame(input, units) {
            var localInput = isMoment(input) ? input : createLocal(input),
                inputMs;
            if (!(this.isValid() && localInput.isValid())) {
                return false;
            }
            units = normalizeUnits(units) || 'millisecond';
            if (units === 'millisecond') {
                return this.valueOf() === localInput.valueOf();
            } else {
                inputMs = localInput.valueOf();
                return (
                    this.clone().startOf(units).valueOf() <= inputMs &&
                    inputMs <= this.clone().endOf(units).valueOf()
                );
            }
        }

        function isSameOrAfter(input, units) {
            return this.isSame(input, units) || this.isAfter(input, units);
        }

        function isSameOrBefore(input, units) {
            return this.isSame(input, units) || this.isBefore(input, units);
        }

        function diff(input, units, asFloat) {
            var that, zoneDelta, output;

            if (!this.isValid()) {
                return NaN;
            }

            that = cloneWithOffset(input, this);

            if (!that.isValid()) {
                return NaN;
            }

            zoneDelta = (that.utcOffset() - this.utcOffset()) * 6e4;

            units = normalizeUnits(units);

            switch (units) {
                case 'year':
                    output = monthDiff(this, that) / 12;
                    break;
                case 'month':
                    output = monthDiff(this, that);
                    break;
                case 'quarter':
                    output = monthDiff(this, that) / 3;
                    break;
                case 'second':
                    output = (this - that) / 1e3;
                    break; // 1000
                case 'minute':
                    output = (this - that) / 6e4;
                    break; // 1000 * 60
                case 'hour':
                    output = (this - that) / 36e5;
                    break; // 1000 * 60 * 60
                case 'day':
                    output = (this - that - zoneDelta) / 864e5;
                    break; // 1000 * 60 * 60 * 24, negate dst
                case 'week':
                    output = (this - that - zoneDelta) / 6048e5;
                    break; // 1000 * 60 * 60 * 24 * 7, negate dst
                default:
                    output = this - that;
            }

            return asFloat ? output : absFloor(output);
        }

        function monthDiff(a, b) {
            if (a.date() < b.date()) {
                // end-of-month calculations work correct when the start month has more
                // days than the end month.
                return -monthDiff(b, a);
            }
            // difference in months
            var wholeMonthDiff = (b.year() - a.year()) * 12 + (b.month() - a.month()),
                // b is in (anchor - 1 month, anchor + 1 month)
                anchor = a.clone().add(wholeMonthDiff, 'months'),
                anchor2,
                adjust;

            if (b - anchor < 0) {
                anchor2 = a.clone().add(wholeMonthDiff - 1, 'months');
                // linear across the month
                adjust = (b - anchor) / (anchor - anchor2);
            } else {
                anchor2 = a.clone().add(wholeMonthDiff + 1, 'months');
                // linear across the month
                adjust = (b - anchor) / (anchor2 - anchor);
            }

            //check for negative zero, return zero if negative zero
            return -(wholeMonthDiff + adjust) || 0;
        }

        hooks.defaultFormat = 'YYYY-MM-DDTHH:mm:ssZ';
        hooks.defaultFormatUtc = 'YYYY-MM-DDTHH:mm:ss[Z]';

        function toString() {
            return this.clone().locale('en').format('ddd MMM DD YYYY HH:mm:ss [GMT]ZZ');
        }

        function toISOString(keepOffset) {
            if (!this.isValid()) {
                return null;
            }
            var utc = keepOffset !== true,
                m = utc ? this.clone().utc() : this;
            if (m.year() < 0 || m.year() > 9999) {
                return formatMoment(
                    m,
                    utc
                        ? 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]'
                        : 'YYYYYY-MM-DD[T]HH:mm:ss.SSSZ'
                );
            }
            if (isFunction(Date.prototype.toISOString)) {
                // native implementation is ~50x faster, use it when we can
                if (utc) {
                    return this.toDate().toISOString();
                } else {
                    return new Date(this.valueOf() + this.utcOffset() * 60 * 1000)
                        .toISOString()
                        .replace('Z', formatMoment(m, 'Z'));
                }
            }
            return formatMoment(
                m,
                utc ? 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]' : 'YYYY-MM-DD[T]HH:mm:ss.SSSZ'
            );
        }

        /**
         * Return a human readable representation of a moment that can
         * also be evaluated to get a new moment which is the same
         *
         * @link https://nodejs.org/dist/latest/docs/api/util.html#util_custom_inspect_function_on_objects
         */
        function inspect() {
            if (!this.isValid()) {
                return 'moment.invalid(/* ' + this._i + ' */)';
            }
            var func = 'moment',
                zone = '',
                prefix,
                year,
                datetime,
                suffix;
            if (!this.isLocal()) {
                func = this.utcOffset() === 0 ? 'moment.utc' : 'moment.parseZone';
                zone = 'Z';
            }
            prefix = '[' + func + '("]';
            year = 0 <= this.year() && this.year() <= 9999 ? 'YYYY' : 'YYYYYY';
            datetime = '-MM-DD[T]HH:mm:ss.SSS';
            suffix = zone + '[")]';

            return this.format(prefix + year + datetime + suffix);
        }

        function format(inputString) {
            if (!inputString) {
                inputString = this.isUtc()
                    ? hooks.defaultFormatUtc
                    : hooks.defaultFormat;
            }
            var output = formatMoment(this, inputString);
            return this.localeData().postformat(output);
        }

        function from(time, withoutSuffix) {
            if (
                this.isValid() &&
                ((isMoment(time) && time.isValid()) || createLocal(time).isValid())
            ) {
                return createDuration({ to: this, from: time })
                    .locale(this.locale())
                    .humanize(!withoutSuffix);
            } else {
                return this.localeData().invalidDate();
            }
        }

        function fromNow(withoutSuffix) {
            return this.from(createLocal(), withoutSuffix);
        }

        function to(time, withoutSuffix) {
            if (
                this.isValid() &&
                ((isMoment(time) && time.isValid()) || createLocal(time).isValid())
            ) {
                return createDuration({ from: this, to: time })
                    .locale(this.locale())
                    .humanize(!withoutSuffix);
            } else {
                return this.localeData().invalidDate();
            }
        }

        function toNow(withoutSuffix) {
            return this.to(createLocal(), withoutSuffix);
        }

        // If passed a locale key, it will set the locale for this
        // instance.  Otherwise, it will return the locale configuration
        // variables for this instance.
        function locale(key) {
            var newLocaleData;

            if (key === undefined) {
                return this._locale._abbr;
            } else {
                newLocaleData = getLocale(key);
                if (newLocaleData != null) {
                    this._locale = newLocaleData;
                }
                return this;
            }
        }

        var lang = deprecate(
            'moment().lang() is deprecated. Instead, use moment().localeData() to get the language configuration. Use moment().locale() to change languages.',
            function (key) {
                if (key === undefined) {
                    return this.localeData();
                } else {
                    return this.locale(key);
                }
            }
        );

        function localeData() {
            return this._locale;
        }

        var MS_PER_SECOND = 1000,
            MS_PER_MINUTE = 60 * MS_PER_SECOND,
            MS_PER_HOUR = 60 * MS_PER_MINUTE,
            MS_PER_400_YEARS = (365 * 400 + 97) * 24 * MS_PER_HOUR;

        // actual modulo - handles negative numbers (for dates before 1970):
        function mod$1(dividend, divisor) {
            return ((dividend % divisor) + divisor) % divisor;
        }

        function localStartOfDate(y, m, d) {
            // the date constructor remaps years 0-99 to 1900-1999
            if (y < 100 && y >= 0) {
                // preserve leap years using a full 400 year cycle, then reset
                return new Date(y + 400, m, d) - MS_PER_400_YEARS;
            } else {
                return new Date(y, m, d).valueOf();
            }
        }

        function utcStartOfDate(y, m, d) {
            // Date.UTC remaps years 0-99 to 1900-1999
            if (y < 100 && y >= 0) {
                // preserve leap years using a full 400 year cycle, then reset
                return Date.UTC(y + 400, m, d) - MS_PER_400_YEARS;
            } else {
                return Date.UTC(y, m, d);
            }
        }

        function startOf(units) {
            var time, startOfDate;
            units = normalizeUnits(units);
            if (units === undefined || units === 'millisecond' || !this.isValid()) {
                return this;
            }

            startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

            switch (units) {
                case 'year':
                    time = startOfDate(this.year(), 0, 1);
                    break;
                case 'quarter':
                    time = startOfDate(
                        this.year(),
                        this.month() - (this.month() % 3),
                        1
                    );
                    break;
                case 'month':
                    time = startOfDate(this.year(), this.month(), 1);
                    break;
                case 'week':
                    time = startOfDate(
                        this.year(),
                        this.month(),
                        this.date() - this.weekday()
                    );
                    break;
                case 'isoWeek':
                    time = startOfDate(
                        this.year(),
                        this.month(),
                        this.date() - (this.isoWeekday() - 1)
                    );
                    break;
                case 'day':
                case 'date':
                    time = startOfDate(this.year(), this.month(), this.date());
                    break;
                case 'hour':
                    time = this._d.valueOf();
                    time -= mod$1(
                        time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE),
                        MS_PER_HOUR
                    );
                    break;
                case 'minute':
                    time = this._d.valueOf();
                    time -= mod$1(time, MS_PER_MINUTE);
                    break;
                case 'second':
                    time = this._d.valueOf();
                    time -= mod$1(time, MS_PER_SECOND);
                    break;
            }

            this._d.setTime(time);
            hooks.updateOffset(this, true);
            return this;
        }

        function endOf(units) {
            var time, startOfDate;
            units = normalizeUnits(units);
            if (units === undefined || units === 'millisecond' || !this.isValid()) {
                return this;
            }

            startOfDate = this._isUTC ? utcStartOfDate : localStartOfDate;

            switch (units) {
                case 'year':
                    time = startOfDate(this.year() + 1, 0, 1) - 1;
                    break;
                case 'quarter':
                    time =
                        startOfDate(
                            this.year(),
                            this.month() - (this.month() % 3) + 3,
                            1
                        ) - 1;
                    break;
                case 'month':
                    time = startOfDate(this.year(), this.month() + 1, 1) - 1;
                    break;
                case 'week':
                    time =
                        startOfDate(
                            this.year(),
                            this.month(),
                            this.date() - this.weekday() + 7
                        ) - 1;
                    break;
                case 'isoWeek':
                    time =
                        startOfDate(
                            this.year(),
                            this.month(),
                            this.date() - (this.isoWeekday() - 1) + 7
                        ) - 1;
                    break;
                case 'day':
                case 'date':
                    time = startOfDate(this.year(), this.month(), this.date() + 1) - 1;
                    break;
                case 'hour':
                    time = this._d.valueOf();
                    time +=
                        MS_PER_HOUR -
                        mod$1(
                            time + (this._isUTC ? 0 : this.utcOffset() * MS_PER_MINUTE),
                            MS_PER_HOUR
                        ) -
                        1;
                    break;
                case 'minute':
                    time = this._d.valueOf();
                    time += MS_PER_MINUTE - mod$1(time, MS_PER_MINUTE) - 1;
                    break;
                case 'second':
                    time = this._d.valueOf();
                    time += MS_PER_SECOND - mod$1(time, MS_PER_SECOND) - 1;
                    break;
            }

            this._d.setTime(time);
            hooks.updateOffset(this, true);
            return this;
        }

        function valueOf() {
            return this._d.valueOf() - (this._offset || 0) * 60000;
        }

        function unix() {
            return Math.floor(this.valueOf() / 1000);
        }

        function toDate() {
            return new Date(this.valueOf());
        }

        function toArray() {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hour(),
                m.minute(),
                m.second(),
                m.millisecond(),
            ];
        }

        function toObject() {
            var m = this;
            return {
                years: m.year(),
                months: m.month(),
                date: m.date(),
                hours: m.hours(),
                minutes: m.minutes(),
                seconds: m.seconds(),
                milliseconds: m.milliseconds(),
            };
        }

        function toJSON() {
            // new Date(NaN).toJSON() === null
            return this.isValid() ? this.toISOString() : null;
        }

        function isValid$2() {
            return isValid(this);
        }

        function parsingFlags() {
            return extend({}, getParsingFlags(this));
        }

        function invalidAt() {
            return getParsingFlags(this).overflow;
        }

        function creationData() {
            return {
                input: this._i,
                format: this._f,
                locale: this._locale,
                isUTC: this._isUTC,
                strict: this._strict,
            };
        }

        addFormatToken('N', 0, 0, 'eraAbbr');
        addFormatToken('NN', 0, 0, 'eraAbbr');
        addFormatToken('NNN', 0, 0, 'eraAbbr');
        addFormatToken('NNNN', 0, 0, 'eraName');
        addFormatToken('NNNNN', 0, 0, 'eraNarrow');

        addFormatToken('y', ['y', 1], 'yo', 'eraYear');
        addFormatToken('y', ['yy', 2], 0, 'eraYear');
        addFormatToken('y', ['yyy', 3], 0, 'eraYear');
        addFormatToken('y', ['yyyy', 4], 0, 'eraYear');

        addRegexToken('N', matchEraAbbr);
        addRegexToken('NN', matchEraAbbr);
        addRegexToken('NNN', matchEraAbbr);
        addRegexToken('NNNN', matchEraName);
        addRegexToken('NNNNN', matchEraNarrow);

        addParseToken(
            ['N', 'NN', 'NNN', 'NNNN', 'NNNNN'],
            function (input, array, config, token) {
                var era = config._locale.erasParse(input, token, config._strict);
                if (era) {
                    getParsingFlags(config).era = era;
                } else {
                    getParsingFlags(config).invalidEra = input;
                }
            }
        );

        addRegexToken('y', matchUnsigned);
        addRegexToken('yy', matchUnsigned);
        addRegexToken('yyy', matchUnsigned);
        addRegexToken('yyyy', matchUnsigned);
        addRegexToken('yo', matchEraYearOrdinal);

        addParseToken(['y', 'yy', 'yyy', 'yyyy'], YEAR);
        addParseToken(['yo'], function (input, array, config, token) {
            var match;
            if (config._locale._eraYearOrdinalRegex) {
                match = input.match(config._locale._eraYearOrdinalRegex);
            }

            if (config._locale.eraYearOrdinalParse) {
                array[YEAR] = config._locale.eraYearOrdinalParse(input, match);
            } else {
                array[YEAR] = parseInt(input, 10);
            }
        });

        function localeEras(m, format) {
            var i,
                l,
                date,
                eras = this._eras || getLocale('en')._eras;
            for (i = 0, l = eras.length; i < l; ++i) {
                switch (typeof eras[i].since) {
                    case 'string':
                        // truncate time
                        date = hooks(eras[i].since).startOf('day');
                        eras[i].since = date.valueOf();
                        break;
                }

                switch (typeof eras[i].until) {
                    case 'undefined':
                        eras[i].until = +Infinity;
                        break;
                    case 'string':
                        // truncate time
                        date = hooks(eras[i].until).startOf('day').valueOf();
                        eras[i].until = date.valueOf();
                        break;
                }
            }
            return eras;
        }

        function localeErasParse(eraName, format, strict) {
            var i,
                l,
                eras = this.eras(),
                name,
                abbr,
                narrow;
            eraName = eraName.toUpperCase();

            for (i = 0, l = eras.length; i < l; ++i) {
                name = eras[i].name.toUpperCase();
                abbr = eras[i].abbr.toUpperCase();
                narrow = eras[i].narrow.toUpperCase();

                if (strict) {
                    switch (format) {
                        case 'N':
                        case 'NN':
                        case 'NNN':
                            if (abbr === eraName) {
                                return eras[i];
                            }
                            break;

                        case 'NNNN':
                            if (name === eraName) {
                                return eras[i];
                            }
                            break;

                        case 'NNNNN':
                            if (narrow === eraName) {
                                return eras[i];
                            }
                            break;
                    }
                } else if ([name, abbr, narrow].indexOf(eraName) >= 0) {
                    return eras[i];
                }
            }
        }

        function localeErasConvertYear(era, year) {
            var dir = era.since <= era.until ? +1 : -1;
            if (year === undefined) {
                return hooks(era.since).year();
            } else {
                return hooks(era.since).year() + (year - era.offset) * dir;
            }
        }

        function getEraName() {
            var i,
                l,
                val,
                eras = this.localeData().eras();
            for (i = 0, l = eras.length; i < l; ++i) {
                // truncate time
                val = this.clone().startOf('day').valueOf();

                if (eras[i].since <= val && val <= eras[i].until) {
                    return eras[i].name;
                }
                if (eras[i].until <= val && val <= eras[i].since) {
                    return eras[i].name;
                }
            }

            return '';
        }

        function getEraNarrow() {
            var i,
                l,
                val,
                eras = this.localeData().eras();
            for (i = 0, l = eras.length; i < l; ++i) {
                // truncate time
                val = this.clone().startOf('day').valueOf();

                if (eras[i].since <= val && val <= eras[i].until) {
                    return eras[i].narrow;
                }
                if (eras[i].until <= val && val <= eras[i].since) {
                    return eras[i].narrow;
                }
            }

            return '';
        }

        function getEraAbbr() {
            var i,
                l,
                val,
                eras = this.localeData().eras();
            for (i = 0, l = eras.length; i < l; ++i) {
                // truncate time
                val = this.clone().startOf('day').valueOf();

                if (eras[i].since <= val && val <= eras[i].until) {
                    return eras[i].abbr;
                }
                if (eras[i].until <= val && val <= eras[i].since) {
                    return eras[i].abbr;
                }
            }

            return '';
        }

        function getEraYear() {
            var i,
                l,
                dir,
                val,
                eras = this.localeData().eras();
            for (i = 0, l = eras.length; i < l; ++i) {
                dir = eras[i].since <= eras[i].until ? +1 : -1;

                // truncate time
                val = this.clone().startOf('day').valueOf();

                if (
                    (eras[i].since <= val && val <= eras[i].until) ||
                    (eras[i].until <= val && val <= eras[i].since)
                ) {
                    return (
                        (this.year() - hooks(eras[i].since).year()) * dir +
                        eras[i].offset
                    );
                }
            }

            return this.year();
        }

        function erasNameRegex(isStrict) {
            if (!hasOwnProp(this, '_erasNameRegex')) {
                computeErasParse.call(this);
            }
            return isStrict ? this._erasNameRegex : this._erasRegex;
        }

        function erasAbbrRegex(isStrict) {
            if (!hasOwnProp(this, '_erasAbbrRegex')) {
                computeErasParse.call(this);
            }
            return isStrict ? this._erasAbbrRegex : this._erasRegex;
        }

        function erasNarrowRegex(isStrict) {
            if (!hasOwnProp(this, '_erasNarrowRegex')) {
                computeErasParse.call(this);
            }
            return isStrict ? this._erasNarrowRegex : this._erasRegex;
        }

        function matchEraAbbr(isStrict, locale) {
            return locale.erasAbbrRegex(isStrict);
        }

        function matchEraName(isStrict, locale) {
            return locale.erasNameRegex(isStrict);
        }

        function matchEraNarrow(isStrict, locale) {
            return locale.erasNarrowRegex(isStrict);
        }

        function matchEraYearOrdinal(isStrict, locale) {
            return locale._eraYearOrdinalRegex || matchUnsigned;
        }

        function computeErasParse() {
            var abbrPieces = [],
                namePieces = [],
                narrowPieces = [],
                mixedPieces = [],
                i,
                l,
                eras = this.eras();

            for (i = 0, l = eras.length; i < l; ++i) {
                namePieces.push(regexEscape(eras[i].name));
                abbrPieces.push(regexEscape(eras[i].abbr));
                narrowPieces.push(regexEscape(eras[i].narrow));

                mixedPieces.push(regexEscape(eras[i].name));
                mixedPieces.push(regexEscape(eras[i].abbr));
                mixedPieces.push(regexEscape(eras[i].narrow));
            }

            this._erasRegex = new RegExp('^(' + mixedPieces.join('|') + ')', 'i');
            this._erasNameRegex = new RegExp('^(' + namePieces.join('|') + ')', 'i');
            this._erasAbbrRegex = new RegExp('^(' + abbrPieces.join('|') + ')', 'i');
            this._erasNarrowRegex = new RegExp(
                '^(' + narrowPieces.join('|') + ')',
                'i'
            );
        }

        // FORMATTING

        addFormatToken(0, ['gg', 2], 0, function () {
            return this.weekYear() % 100;
        });

        addFormatToken(0, ['GG', 2], 0, function () {
            return this.isoWeekYear() % 100;
        });

        function addWeekYearFormatToken(token, getter) {
            addFormatToken(0, [token, token.length], 0, getter);
        }

        addWeekYearFormatToken('gggg', 'weekYear');
        addWeekYearFormatToken('ggggg', 'weekYear');
        addWeekYearFormatToken('GGGG', 'isoWeekYear');
        addWeekYearFormatToken('GGGGG', 'isoWeekYear');

        // ALIASES

        addUnitAlias('weekYear', 'gg');
        addUnitAlias('isoWeekYear', 'GG');

        // PRIORITY

        addUnitPriority('weekYear', 1);
        addUnitPriority('isoWeekYear', 1);

        // PARSING

        addRegexToken('G', matchSigned);
        addRegexToken('g', matchSigned);
        addRegexToken('GG', match1to2, match2);
        addRegexToken('gg', match1to2, match2);
        addRegexToken('GGGG', match1to4, match4);
        addRegexToken('gggg', match1to4, match4);
        addRegexToken('GGGGG', match1to6, match6);
        addRegexToken('ggggg', match1to6, match6);

        addWeekParseToken(
            ['gggg', 'ggggg', 'GGGG', 'GGGGG'],
            function (input, week, config, token) {
                week[token.substr(0, 2)] = toInt(input);
            }
        );

        addWeekParseToken(['gg', 'GG'], function (input, week, config, token) {
            week[token] = hooks.parseTwoDigitYear(input);
        });

        // MOMENTS

        function getSetWeekYear(input) {
            return getSetWeekYearHelper.call(
                this,
                input,
                this.week(),
                this.weekday(),
                this.localeData()._week.dow,
                this.localeData()._week.doy
            );
        }

        function getSetISOWeekYear(input) {
            return getSetWeekYearHelper.call(
                this,
                input,
                this.isoWeek(),
                this.isoWeekday(),
                1,
                4
            );
        }

        function getISOWeeksInYear() {
            return weeksInYear(this.year(), 1, 4);
        }

        function getISOWeeksInISOWeekYear() {
            return weeksInYear(this.isoWeekYear(), 1, 4);
        }

        function getWeeksInYear() {
            var weekInfo = this.localeData()._week;
            return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        }

        function getWeeksInWeekYear() {
            var weekInfo = this.localeData()._week;
            return weeksInYear(this.weekYear(), weekInfo.dow, weekInfo.doy);
        }

        function getSetWeekYearHelper(input, week, weekday, dow, doy) {
            var weeksTarget;
            if (input == null) {
                return weekOfYear(this, dow, doy).year;
            } else {
                weeksTarget = weeksInYear(input, dow, doy);
                if (week > weeksTarget) {
                    week = weeksTarget;
                }
                return setWeekAll.call(this, input, week, weekday, dow, doy);
            }
        }

        function setWeekAll(weekYear, week, weekday, dow, doy) {
            var dayOfYearData = dayOfYearFromWeeks(weekYear, week, weekday, dow, doy),
                date = createUTCDate(dayOfYearData.year, 0, dayOfYearData.dayOfYear);

            this.year(date.getUTCFullYear());
            this.month(date.getUTCMonth());
            this.date(date.getUTCDate());
            return this;
        }

        // FORMATTING

        addFormatToken('Q', 0, 'Qo', 'quarter');

        // ALIASES

        addUnitAlias('quarter', 'Q');

        // PRIORITY

        addUnitPriority('quarter', 7);

        // PARSING

        addRegexToken('Q', match1);
        addParseToken('Q', function (input, array) {
            array[MONTH] = (toInt(input) - 1) * 3;
        });

        // MOMENTS

        function getSetQuarter(input) {
            return input == null
                ? Math.ceil((this.month() + 1) / 3)
                : this.month((input - 1) * 3 + (this.month() % 3));
        }

        // FORMATTING

        addFormatToken('D', ['DD', 2], 'Do', 'date');

        // ALIASES

        addUnitAlias('date', 'D');

        // PRIORITY
        addUnitPriority('date', 9);

        // PARSING

        addRegexToken('D', match1to2);
        addRegexToken('DD', match1to2, match2);
        addRegexToken('Do', function (isStrict, locale) {
            // TODO: Remove "ordinalParse" fallback in next major release.
            return isStrict
                ? locale._dayOfMonthOrdinalParse || locale._ordinalParse
                : locale._dayOfMonthOrdinalParseLenient;
        });

        addParseToken(['D', 'DD'], DATE);
        addParseToken('Do', function (input, array) {
            array[DATE] = toInt(input.match(match1to2)[0]);
        });

        // MOMENTS

        var getSetDayOfMonth = makeGetSet('Date', true);

        // FORMATTING

        addFormatToken('DDD', ['DDDD', 3], 'DDDo', 'dayOfYear');

        // ALIASES

        addUnitAlias('dayOfYear', 'DDD');

        // PRIORITY
        addUnitPriority('dayOfYear', 4);

        // PARSING

        addRegexToken('DDD', match1to3);
        addRegexToken('DDDD', match3);
        addParseToken(['DDD', 'DDDD'], function (input, array, config) {
            config._dayOfYear = toInt(input);
        });

        // HELPERS

        // MOMENTS

        function getSetDayOfYear(input) {
            var dayOfYear =
                Math.round(
                    (this.clone().startOf('day') - this.clone().startOf('year')) / 864e5
                ) + 1;
            return input == null ? dayOfYear : this.add(input - dayOfYear, 'd');
        }

        // FORMATTING

        addFormatToken('m', ['mm', 2], 0, 'minute');

        // ALIASES

        addUnitAlias('minute', 'm');

        // PRIORITY

        addUnitPriority('minute', 14);

        // PARSING

        addRegexToken('m', match1to2);
        addRegexToken('mm', match1to2, match2);
        addParseToken(['m', 'mm'], MINUTE);

        // MOMENTS

        var getSetMinute = makeGetSet('Minutes', false);

        // FORMATTING

        addFormatToken('s', ['ss', 2], 0, 'second');

        // ALIASES

        addUnitAlias('second', 's');

        // PRIORITY

        addUnitPriority('second', 15);

        // PARSING

        addRegexToken('s', match1to2);
        addRegexToken('ss', match1to2, match2);
        addParseToken(['s', 'ss'], SECOND);

        // MOMENTS

        var getSetSecond = makeGetSet('Seconds', false);

        // FORMATTING

        addFormatToken('S', 0, 0, function () {
            return ~~(this.millisecond() / 100);
        });

        addFormatToken(0, ['SS', 2], 0, function () {
            return ~~(this.millisecond() / 10);
        });

        addFormatToken(0, ['SSS', 3], 0, 'millisecond');
        addFormatToken(0, ['SSSS', 4], 0, function () {
            return this.millisecond() * 10;
        });
        addFormatToken(0, ['SSSSS', 5], 0, function () {
            return this.millisecond() * 100;
        });
        addFormatToken(0, ['SSSSSS', 6], 0, function () {
            return this.millisecond() * 1000;
        });
        addFormatToken(0, ['SSSSSSS', 7], 0, function () {
            return this.millisecond() * 10000;
        });
        addFormatToken(0, ['SSSSSSSS', 8], 0, function () {
            return this.millisecond() * 100000;
        });
        addFormatToken(0, ['SSSSSSSSS', 9], 0, function () {
            return this.millisecond() * 1000000;
        });

        // ALIASES

        addUnitAlias('millisecond', 'ms');

        // PRIORITY

        addUnitPriority('millisecond', 16);

        // PARSING

        addRegexToken('S', match1to3, match1);
        addRegexToken('SS', match1to3, match2);
        addRegexToken('SSS', match1to3, match3);

        var token, getSetMillisecond;
        for (token = 'SSSS'; token.length <= 9; token += 'S') {
            addRegexToken(token, matchUnsigned);
        }

        function parseMs(input, array) {
            array[MILLISECOND] = toInt(('0.' + input) * 1000);
        }

        for (token = 'S'; token.length <= 9; token += 'S') {
            addParseToken(token, parseMs);
        }

        getSetMillisecond = makeGetSet('Milliseconds', false);

        // FORMATTING

        addFormatToken('z', 0, 0, 'zoneAbbr');
        addFormatToken('zz', 0, 0, 'zoneName');

        // MOMENTS

        function getZoneAbbr() {
            return this._isUTC ? 'UTC' : '';
        }

        function getZoneName() {
            return this._isUTC ? 'Coordinated Universal Time' : '';
        }

        var proto = Moment.prototype;

        proto.add = add;
        proto.calendar = calendar$1;
        proto.clone = clone;
        proto.diff = diff;
        proto.endOf = endOf;
        proto.format = format;
        proto.from = from;
        proto.fromNow = fromNow;
        proto.to = to;
        proto.toNow = toNow;
        proto.get = stringGet;
        proto.invalidAt = invalidAt;
        proto.isAfter = isAfter;
        proto.isBefore = isBefore;
        proto.isBetween = isBetween;
        proto.isSame = isSame;
        proto.isSameOrAfter = isSameOrAfter;
        proto.isSameOrBefore = isSameOrBefore;
        proto.isValid = isValid$2;
        proto.lang = lang;
        proto.locale = locale;
        proto.localeData = localeData;
        proto.max = prototypeMax;
        proto.min = prototypeMin;
        proto.parsingFlags = parsingFlags;
        proto.set = stringSet;
        proto.startOf = startOf;
        proto.subtract = subtract;
        proto.toArray = toArray;
        proto.toObject = toObject;
        proto.toDate = toDate;
        proto.toISOString = toISOString;
        proto.inspect = inspect;
        if (typeof Symbol !== 'undefined' && Symbol.for != null) {
            proto[Symbol.for('nodejs.util.inspect.custom')] = function () {
                return 'Moment<' + this.format() + '>';
            };
        }
        proto.toJSON = toJSON;
        proto.toString = toString;
        proto.unix = unix;
        proto.valueOf = valueOf;
        proto.creationData = creationData;
        proto.eraName = getEraName;
        proto.eraNarrow = getEraNarrow;
        proto.eraAbbr = getEraAbbr;
        proto.eraYear = getEraYear;
        proto.year = getSetYear;
        proto.isLeapYear = getIsLeapYear;
        proto.weekYear = getSetWeekYear;
        proto.isoWeekYear = getSetISOWeekYear;
        proto.quarter = proto.quarters = getSetQuarter;
        proto.month = getSetMonth;
        proto.daysInMonth = getDaysInMonth;
        proto.week = proto.weeks = getSetWeek;
        proto.isoWeek = proto.isoWeeks = getSetISOWeek;
        proto.weeksInYear = getWeeksInYear;
        proto.weeksInWeekYear = getWeeksInWeekYear;
        proto.isoWeeksInYear = getISOWeeksInYear;
        proto.isoWeeksInISOWeekYear = getISOWeeksInISOWeekYear;
        proto.date = getSetDayOfMonth;
        proto.day = proto.days = getSetDayOfWeek;
        proto.weekday = getSetLocaleDayOfWeek;
        proto.isoWeekday = getSetISODayOfWeek;
        proto.dayOfYear = getSetDayOfYear;
        proto.hour = proto.hours = getSetHour;
        proto.minute = proto.minutes = getSetMinute;
        proto.second = proto.seconds = getSetSecond;
        proto.millisecond = proto.milliseconds = getSetMillisecond;
        proto.utcOffset = getSetOffset;
        proto.utc = setOffsetToUTC;
        proto.local = setOffsetToLocal;
        proto.parseZone = setOffsetToParsedOffset;
        proto.hasAlignedHourOffset = hasAlignedHourOffset;
        proto.isDST = isDaylightSavingTime;
        proto.isLocal = isLocal;
        proto.isUtcOffset = isUtcOffset;
        proto.isUtc = isUtc;
        proto.isUTC = isUtc;
        proto.zoneAbbr = getZoneAbbr;
        proto.zoneName = getZoneName;
        proto.dates = deprecate(
            'dates accessor is deprecated. Use date instead.',
            getSetDayOfMonth
        );
        proto.months = deprecate(
            'months accessor is deprecated. Use month instead',
            getSetMonth
        );
        proto.years = deprecate(
            'years accessor is deprecated. Use year instead',
            getSetYear
        );
        proto.zone = deprecate(
            'moment().zone is deprecated, use moment().utcOffset instead. http://momentjs.com/guides/#/warnings/zone/',
            getSetZone
        );
        proto.isDSTShifted = deprecate(
            'isDSTShifted is deprecated. See http://momentjs.com/guides/#/warnings/dst-shifted/ for more information',
            isDaylightSavingTimeShifted
        );

        function createUnix(input) {
            return createLocal(input * 1000);
        }

        function createInZone() {
            return createLocal.apply(null, arguments).parseZone();
        }

        function preParsePostFormat(string) {
            return string;
        }

        var proto$1 = Locale.prototype;

        proto$1.calendar = calendar;
        proto$1.longDateFormat = longDateFormat;
        proto$1.invalidDate = invalidDate;
        proto$1.ordinal = ordinal;
        proto$1.preparse = preParsePostFormat;
        proto$1.postformat = preParsePostFormat;
        proto$1.relativeTime = relativeTime;
        proto$1.pastFuture = pastFuture;
        proto$1.set = set;
        proto$1.eras = localeEras;
        proto$1.erasParse = localeErasParse;
        proto$1.erasConvertYear = localeErasConvertYear;
        proto$1.erasAbbrRegex = erasAbbrRegex;
        proto$1.erasNameRegex = erasNameRegex;
        proto$1.erasNarrowRegex = erasNarrowRegex;

        proto$1.months = localeMonths;
        proto$1.monthsShort = localeMonthsShort;
        proto$1.monthsParse = localeMonthsParse;
        proto$1.monthsRegex = monthsRegex;
        proto$1.monthsShortRegex = monthsShortRegex;
        proto$1.week = localeWeek;
        proto$1.firstDayOfYear = localeFirstDayOfYear;
        proto$1.firstDayOfWeek = localeFirstDayOfWeek;

        proto$1.weekdays = localeWeekdays;
        proto$1.weekdaysMin = localeWeekdaysMin;
        proto$1.weekdaysShort = localeWeekdaysShort;
        proto$1.weekdaysParse = localeWeekdaysParse;

        proto$1.weekdaysRegex = weekdaysRegex;
        proto$1.weekdaysShortRegex = weekdaysShortRegex;
        proto$1.weekdaysMinRegex = weekdaysMinRegex;

        proto$1.isPM = localeIsPM;
        proto$1.meridiem = localeMeridiem;

        function get$1(format, index, field, setter) {
            var locale = getLocale(),
                utc = createUTC().set(setter, index);
            return locale[field](utc, format);
        }

        function listMonthsImpl(format, index, field) {
            if (isNumber(format)) {
                index = format;
                format = undefined;
            }

            format = format || '';

            if (index != null) {
                return get$1(format, index, field, 'month');
            }

            var i,
                out = [];
            for (i = 0; i < 12; i++) {
                out[i] = get$1(format, i, field, 'month');
            }
            return out;
        }

        // ()
        // (5)
        // (fmt, 5)
        // (fmt)
        // (true)
        // (true, 5)
        // (true, fmt, 5)
        // (true, fmt)
        function listWeekdaysImpl(localeSorted, format, index, field) {
            if (typeof localeSorted === 'boolean') {
                if (isNumber(format)) {
                    index = format;
                    format = undefined;
                }

                format = format || '';
            } else {
                format = localeSorted;
                index = format;
                localeSorted = false;

                if (isNumber(format)) {
                    index = format;
                    format = undefined;
                }

                format = format || '';
            }

            var locale = getLocale(),
                shift = localeSorted ? locale._week.dow : 0,
                i,
                out = [];

            if (index != null) {
                return get$1(format, (index + shift) % 7, field, 'day');
            }

            for (i = 0; i < 7; i++) {
                out[i] = get$1(format, (i + shift) % 7, field, 'day');
            }
            return out;
        }

        function listMonths(format, index) {
            return listMonthsImpl(format, index, 'months');
        }

        function listMonthsShort(format, index) {
            return listMonthsImpl(format, index, 'monthsShort');
        }

        function listWeekdays(localeSorted, format, index) {
            return listWeekdaysImpl(localeSorted, format, index, 'weekdays');
        }

        function listWeekdaysShort(localeSorted, format, index) {
            return listWeekdaysImpl(localeSorted, format, index, 'weekdaysShort');
        }

        function listWeekdaysMin(localeSorted, format, index) {
            return listWeekdaysImpl(localeSorted, format, index, 'weekdaysMin');
        }

        getSetGlobalLocale('en', {
            eras: [
                {
                    since: '0001-01-01',
                    until: +Infinity,
                    offset: 1,
                    name: 'Anno Domini',
                    narrow: 'AD',
                    abbr: 'AD',
                },
                {
                    since: '0000-12-31',
                    until: -Infinity,
                    offset: 1,
                    name: 'Before Christ',
                    narrow: 'BC',
                    abbr: 'BC',
                },
            ],
            dayOfMonthOrdinalParse: /\d{1,2}(th|st|nd|rd)/,
            ordinal: function (number) {
                var b = number % 10,
                    output =
                        toInt((number % 100) / 10) === 1
                            ? 'th'
                            : b === 1
                            ? 'st'
                            : b === 2
                            ? 'nd'
                            : b === 3
                            ? 'rd'
                            : 'th';
                return number + output;
            },
        });

        // Side effect imports

        hooks.lang = deprecate(
            'moment.lang is deprecated. Use moment.locale instead.',
            getSetGlobalLocale
        );
        hooks.langData = deprecate(
            'moment.langData is deprecated. Use moment.localeData instead.',
            getLocale
        );

        var mathAbs = Math.abs;

        function abs() {
            var data = this._data;

            this._milliseconds = mathAbs(this._milliseconds);
            this._days = mathAbs(this._days);
            this._months = mathAbs(this._months);

            data.milliseconds = mathAbs(data.milliseconds);
            data.seconds = mathAbs(data.seconds);
            data.minutes = mathAbs(data.minutes);
            data.hours = mathAbs(data.hours);
            data.months = mathAbs(data.months);
            data.years = mathAbs(data.years);

            return this;
        }

        function addSubtract$1(duration, input, value, direction) {
            var other = createDuration(input, value);

            duration._milliseconds += direction * other._milliseconds;
            duration._days += direction * other._days;
            duration._months += direction * other._months;

            return duration._bubble();
        }

        // supports only 2.0-style add(1, 's') or add(duration)
        function add$1(input, value) {
            return addSubtract$1(this, input, value, 1);
        }

        // supports only 2.0-style subtract(1, 's') or subtract(duration)
        function subtract$1(input, value) {
            return addSubtract$1(this, input, value, -1);
        }

        function absCeil(number) {
            if (number < 0) {
                return Math.floor(number);
            } else {
                return Math.ceil(number);
            }
        }

        function bubble() {
            var milliseconds = this._milliseconds,
                days = this._days,
                months = this._months,
                data = this._data,
                seconds,
                minutes,
                hours,
                years,
                monthsFromDays;

            // if we have a mix of positive and negative values, bubble down first
            // check: https://github.com/moment/moment/issues/2166
            if (
                !(
                    (milliseconds >= 0 && days >= 0 && months >= 0) ||
                    (milliseconds <= 0 && days <= 0 && months <= 0)
                )
            ) {
                milliseconds += absCeil(monthsToDays(months) + days) * 864e5;
                days = 0;
                months = 0;
            }

            // The following code bubbles up values, see the tests for
            // examples of what that means.
            data.milliseconds = milliseconds % 1000;

            seconds = absFloor(milliseconds / 1000);
            data.seconds = seconds % 60;

            minutes = absFloor(seconds / 60);
            data.minutes = minutes % 60;

            hours = absFloor(minutes / 60);
            data.hours = hours % 24;

            days += absFloor(hours / 24);

            // convert days to months
            monthsFromDays = absFloor(daysToMonths(days));
            months += monthsFromDays;
            days -= absCeil(monthsToDays(monthsFromDays));

            // 12 months -> 1 year
            years = absFloor(months / 12);
            months %= 12;

            data.days = days;
            data.months = months;
            data.years = years;

            return this;
        }

        function daysToMonths(days) {
            // 400 years have 146097 days (taking into account leap year rules)
            // 400 years have 12 months === 4800
            return (days * 4800) / 146097;
        }

        function monthsToDays(months) {
            // the reverse of daysToMonths
            return (months * 146097) / 4800;
        }

        function as(units) {
            if (!this.isValid()) {
                return NaN;
            }
            var days,
                months,
                milliseconds = this._milliseconds;

            units = normalizeUnits(units);

            if (units === 'month' || units === 'quarter' || units === 'year') {
                days = this._days + milliseconds / 864e5;
                months = this._months + daysToMonths(days);
                switch (units) {
                    case 'month':
                        return months;
                    case 'quarter':
                        return months / 3;
                    case 'year':
                        return months / 12;
                }
            } else {
                // handle milliseconds separately because of floating point math errors (issue #1867)
                days = this._days + Math.round(monthsToDays(this._months));
                switch (units) {
                    case 'week':
                        return days / 7 + milliseconds / 6048e5;
                    case 'day':
                        return days + milliseconds / 864e5;
                    case 'hour':
                        return days * 24 + milliseconds / 36e5;
                    case 'minute':
                        return days * 1440 + milliseconds / 6e4;
                    case 'second':
                        return days * 86400 + milliseconds / 1000;
                    // Math.floor prevents floating point math errors here
                    case 'millisecond':
                        return Math.floor(days * 864e5) + milliseconds;
                    default:
                        throw new Error('Unknown unit ' + units);
                }
            }
        }

        // TODO: Use this.as('ms')?
        function valueOf$1() {
            if (!this.isValid()) {
                return NaN;
            }
            return (
                this._milliseconds +
                this._days * 864e5 +
                (this._months % 12) * 2592e6 +
                toInt(this._months / 12) * 31536e6
            );
        }

        function makeAs(alias) {
            return function () {
                return this.as(alias);
            };
        }

        var asMilliseconds = makeAs('ms'),
            asSeconds = makeAs('s'),
            asMinutes = makeAs('m'),
            asHours = makeAs('h'),
            asDays = makeAs('d'),
            asWeeks = makeAs('w'),
            asMonths = makeAs('M'),
            asQuarters = makeAs('Q'),
            asYears = makeAs('y');

        function clone$1() {
            return createDuration(this);
        }

        function get$2(units) {
            units = normalizeUnits(units);
            return this.isValid() ? this[units + 's']() : NaN;
        }

        function makeGetter(name) {
            return function () {
                return this.isValid() ? this._data[name] : NaN;
            };
        }

        var milliseconds = makeGetter('milliseconds'),
            seconds = makeGetter('seconds'),
            minutes = makeGetter('minutes'),
            hours = makeGetter('hours'),
            days = makeGetter('days'),
            months = makeGetter('months'),
            years = makeGetter('years');

        function weeks() {
            return absFloor(this.days() / 7);
        }

        var round = Math.round,
            thresholds = {
                ss: 44, // a few seconds to seconds
                s: 45, // seconds to minute
                m: 45, // minutes to hour
                h: 22, // hours to day
                d: 26, // days to month/week
                w: null, // weeks to month
                M: 11, // months to year
            };

        // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
        function substituteTimeAgo(string, number, withoutSuffix, isFuture, locale) {
            return locale.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
        }

        function relativeTime$1(posNegDuration, withoutSuffix, thresholds, locale) {
            var duration = createDuration(posNegDuration).abs(),
                seconds = round(duration.as('s')),
                minutes = round(duration.as('m')),
                hours = round(duration.as('h')),
                days = round(duration.as('d')),
                months = round(duration.as('M')),
                weeks = round(duration.as('w')),
                years = round(duration.as('y')),
                a =
                    (seconds <= thresholds.ss && ['s', seconds]) ||
                    (seconds < thresholds.s && ['ss', seconds]) ||
                    (minutes <= 1 && ['m']) ||
                    (minutes < thresholds.m && ['mm', minutes]) ||
                    (hours <= 1 && ['h']) ||
                    (hours < thresholds.h && ['hh', hours]) ||
                    (days <= 1 && ['d']) ||
                    (days < thresholds.d && ['dd', days]);

            if (thresholds.w != null) {
                a =
                    a ||
                    (weeks <= 1 && ['w']) ||
                    (weeks < thresholds.w && ['ww', weeks]);
            }
            a = a ||
                (months <= 1 && ['M']) ||
                (months < thresholds.M && ['MM', months]) ||
                (years <= 1 && ['y']) || ['yy', years];

            a[2] = withoutSuffix;
            a[3] = +posNegDuration > 0;
            a[4] = locale;
            return substituteTimeAgo.apply(null, a);
        }

        // This function allows you to set the rounding function for relative time strings
        function getSetRelativeTimeRounding(roundingFunction) {
            if (roundingFunction === undefined) {
                return round;
            }
            if (typeof roundingFunction === 'function') {
                round = roundingFunction;
                return true;
            }
            return false;
        }

        // This function allows you to set a threshold for relative time strings
        function getSetRelativeTimeThreshold(threshold, limit) {
            if (thresholds[threshold] === undefined) {
                return false;
            }
            if (limit === undefined) {
                return thresholds[threshold];
            }
            thresholds[threshold] = limit;
            if (threshold === 's') {
                thresholds.ss = limit - 1;
            }
            return true;
        }

        function humanize(argWithSuffix, argThresholds) {
            if (!this.isValid()) {
                return this.localeData().invalidDate();
            }

            var withSuffix = false,
                th = thresholds,
                locale,
                output;

            if (typeof argWithSuffix === 'object') {
                argThresholds = argWithSuffix;
                argWithSuffix = false;
            }
            if (typeof argWithSuffix === 'boolean') {
                withSuffix = argWithSuffix;
            }
            if (typeof argThresholds === 'object') {
                th = Object.assign({}, thresholds, argThresholds);
                if (argThresholds.s != null && argThresholds.ss == null) {
                    th.ss = argThresholds.s - 1;
                }
            }

            locale = this.localeData();
            output = relativeTime$1(this, !withSuffix, th, locale);

            if (withSuffix) {
                output = locale.pastFuture(+this, output);
            }

            return locale.postformat(output);
        }

        var abs$1 = Math.abs;

        function sign(x) {
            return (x > 0) - (x < 0) || +x;
        }

        function toISOString$1() {
            // for ISO strings we do not use the normal bubbling rules:
            //  * milliseconds bubble up until they become hours
            //  * days do not bubble at all
            //  * months bubble up until they become years
            // This is because there is no context-free conversion between hours and days
            // (think of clock changes)
            // and also not between days and months (28-31 days per month)
            if (!this.isValid()) {
                return this.localeData().invalidDate();
            }

            var seconds = abs$1(this._milliseconds) / 1000,
                days = abs$1(this._days),
                months = abs$1(this._months),
                minutes,
                hours,
                years,
                s,
                total = this.asSeconds(),
                totalSign,
                ymSign,
                daysSign,
                hmsSign;

            if (!total) {
                // this is the same as C#'s (Noda) and python (isodate)...
                // but not other JS (goog.date)
                return 'P0D';
            }

            // 3600 seconds -> 60 minutes -> 1 hour
            minutes = absFloor(seconds / 60);
            hours = absFloor(minutes / 60);
            seconds %= 60;
            minutes %= 60;

            // 12 months -> 1 year
            years = absFloor(months / 12);
            months %= 12;

            // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
            s = seconds ? seconds.toFixed(3).replace(/\.?0+$/, '') : '';

            totalSign = total < 0 ? '-' : '';
            ymSign = sign(this._months) !== sign(total) ? '-' : '';
            daysSign = sign(this._days) !== sign(total) ? '-' : '';
            hmsSign = sign(this._milliseconds) !== sign(total) ? '-' : '';

            return (
                totalSign +
                'P' +
                (years ? ymSign + years + 'Y' : '') +
                (months ? ymSign + months + 'M' : '') +
                (days ? daysSign + days + 'D' : '') +
                (hours || minutes || seconds ? 'T' : '') +
                (hours ? hmsSign + hours + 'H' : '') +
                (minutes ? hmsSign + minutes + 'M' : '') +
                (seconds ? hmsSign + s + 'S' : '')
            );
        }

        var proto$2 = Duration.prototype;

        proto$2.isValid = isValid$1;
        proto$2.abs = abs;
        proto$2.add = add$1;
        proto$2.subtract = subtract$1;
        proto$2.as = as;
        proto$2.asMilliseconds = asMilliseconds;
        proto$2.asSeconds = asSeconds;
        proto$2.asMinutes = asMinutes;
        proto$2.asHours = asHours;
        proto$2.asDays = asDays;
        proto$2.asWeeks = asWeeks;
        proto$2.asMonths = asMonths;
        proto$2.asQuarters = asQuarters;
        proto$2.asYears = asYears;
        proto$2.valueOf = valueOf$1;
        proto$2._bubble = bubble;
        proto$2.clone = clone$1;
        proto$2.get = get$2;
        proto$2.milliseconds = milliseconds;
        proto$2.seconds = seconds;
        proto$2.minutes = minutes;
        proto$2.hours = hours;
        proto$2.days = days;
        proto$2.weeks = weeks;
        proto$2.months = months;
        proto$2.years = years;
        proto$2.humanize = humanize;
        proto$2.toISOString = toISOString$1;
        proto$2.toString = toISOString$1;
        proto$2.toJSON = toISOString$1;
        proto$2.locale = locale;
        proto$2.localeData = localeData;

        proto$2.toIsoString = deprecate(
            'toIsoString() is deprecated. Please use toISOString() instead (notice the capitals)',
            toISOString$1
        );
        proto$2.lang = lang;

        // FORMATTING

        addFormatToken('X', 0, 0, 'unix');
        addFormatToken('x', 0, 0, 'valueOf');

        // PARSING

        addRegexToken('x', matchSigned);
        addRegexToken('X', matchTimestamp);
        addParseToken('X', function (input, array, config) {
            config._d = new Date(parseFloat(input) * 1000);
        });
        addParseToken('x', function (input, array, config) {
            config._d = new Date(toInt(input));
        });

        //! moment.js

        hooks.version = '2.29.2';

        setHookCallback(createLocal);

        hooks.fn = proto;
        hooks.min = min;
        hooks.max = max;
        hooks.now = now;
        hooks.utc = createUTC;
        hooks.unix = createUnix;
        hooks.months = listMonths;
        hooks.isDate = isDate;
        hooks.locale = getSetGlobalLocale;
        hooks.invalid = createInvalid;
        hooks.duration = createDuration;
        hooks.isMoment = isMoment;
        hooks.weekdays = listWeekdays;
        hooks.parseZone = createInZone;
        hooks.localeData = getLocale;
        hooks.isDuration = isDuration;
        hooks.monthsShort = listMonthsShort;
        hooks.weekdaysMin = listWeekdaysMin;
        hooks.defineLocale = defineLocale;
        hooks.updateLocale = updateLocale;
        hooks.locales = listLocales;
        hooks.weekdaysShort = listWeekdaysShort;
        hooks.normalizeUnits = normalizeUnits;
        hooks.relativeTimeRounding = getSetRelativeTimeRounding;
        hooks.relativeTimeThreshold = getSetRelativeTimeThreshold;
        hooks.calendarFormat = getCalendarFormat;
        hooks.prototype = proto;

        // currently HTML5 input type only supports 24-hour formats
        hooks.HTML5_FMT = {
            DATETIME_LOCAL: 'YYYY-MM-DDTHH:mm', // <input type="datetime-local" />
            DATETIME_LOCAL_SECONDS: 'YYYY-MM-DDTHH:mm:ss', // <input type="datetime-local" step="1" />
            DATETIME_LOCAL_MS: 'YYYY-MM-DDTHH:mm:ss.SSS', // <input type="datetime-local" step="0.001" />
            DATE: 'YYYY-MM-DD', // <input type="date" />
            TIME: 'HH:mm', // <input type="time" />
            TIME_SECONDS: 'HH:mm:ss', // <input type="time" step="1" />
            TIME_MS: 'HH:mm:ss.SSS', // <input type="time" step="0.001" />
            WEEK: 'GGGG-[W]WW', // <input type="week" />
            MONTH: 'YYYY-MM', // <input type="month" />
        };

        return hooks;

    })));
    }(moment$1));

    var moment = moment$1.exports;

    (function (module, exports) {
    (function (global, factory) {
       typeof commonjsRequire === 'function' ? factory(moment$1.exports) :
       factory(global.moment);
    }(commonjsGlobal, (function (moment) {
        //! moment.js locale configuration

        var pt = moment.defineLocale('pt', {
            months: 'janeiro_fevereiro_março_abril_maio_junho_julho_agosto_setembro_outubro_novembro_dezembro'.split(
                '_'
            ),
            monthsShort: 'jan_fev_mar_abr_mai_jun_jul_ago_set_out_nov_dez'.split('_'),
            weekdays:
                'Domingo_Segunda-feira_Terça-feira_Quarta-feira_Quinta-feira_Sexta-feira_Sábado'.split(
                    '_'
                ),
            weekdaysShort: 'Dom_Seg_Ter_Qua_Qui_Sex_Sáb'.split('_'),
            weekdaysMin: 'Do_2ª_3ª_4ª_5ª_6ª_Sá'.split('_'),
            weekdaysParseExact: true,
            longDateFormat: {
                LT: 'HH:mm',
                LTS: 'HH:mm:ss',
                L: 'DD/MM/YYYY',
                LL: 'D [de] MMMM [de] YYYY',
                LLL: 'D [de] MMMM [de] YYYY HH:mm',
                LLLL: 'dddd, D [de] MMMM [de] YYYY HH:mm',
            },
            calendar: {
                sameDay: '[Hoje às] LT',
                nextDay: '[Amanhã às] LT',
                nextWeek: 'dddd [às] LT',
                lastDay: '[Ontem às] LT',
                lastWeek: function () {
                    return this.day() === 0 || this.day() === 6
                        ? '[Último] dddd [às] LT' // Saturday + Sunday
                        : '[Última] dddd [às] LT'; // Monday - Friday
                },
                sameElse: 'L',
            },
            relativeTime: {
                future: 'em %s',
                past: 'há %s',
                s: 'segundos',
                ss: '%d segundos',
                m: 'um minuto',
                mm: '%d minutos',
                h: 'uma hora',
                hh: '%d horas',
                d: 'um dia',
                dd: '%d dias',
                w: 'uma semana',
                ww: '%d semanas',
                M: 'um mês',
                MM: '%d meses',
                y: 'um ano',
                yy: '%d anos',
            },
            dayOfMonthOrdinalParse: /\d{1,2}º/,
            ordinal: '%dº',
            week: {
                dow: 1, // Monday is the first day of the week.
                doy: 4, // The week that contains Jan 4th is the first week of the year.
            },
        });

        return pt;

    })));
    }());

    /* src\components\Navbar.svelte generated by Svelte v3.47.0 */

    const { Object: Object_1$3 } = globals;
    const file$a = "src\\components\\Navbar.svelte";

    function create_fragment$a(ctx) {
    	let nav;
    	let a0;
    	let i0;
    	let t0;
    	let form;
    	let div1;
    	let input;
    	let t1;
    	let div0;
    	let button;
    	let i1;
    	let t2;
    	let div4;
    	let ul;
    	let li;
    	let a1;
    	let i2;
    	let t3;
    	let a2;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t4;
    	let span;
    	let t5_value = /*user*/ ctx[0].instagram + "";
    	let t5;
    	let t6;
    	let div3;
    	let a3;
    	let i3;
    	let t7;
    	let a3_href_value;
    	let t8;
    	let a4;
    	let i4;
    	let t9;
    	let t10;
    	let div2;
    	let t11;
    	let a5;
    	let t12;
    	let t13;
    	let a6;
    	let t14;
    	let t15;
    	let a7;
    	let t16;

    	const block = {
    		c: function create() {
    			nav = element("nav");
    			a0 = element("a");
    			i0 = element("i");
    			t0 = space();
    			form = element("form");
    			div1 = element("div");
    			input = element("input");
    			t1 = space();
    			div0 = element("div");
    			button = element("button");
    			i1 = element("i");
    			t2 = space();
    			div4 = element("div");
    			ul = element("ul");
    			li = element("li");
    			a1 = element("a");
    			i2 = element("i");
    			t3 = space();
    			a2 = element("a");
    			img = element("img");
    			t4 = space();
    			span = element("span");
    			t5 = text(t5_value);
    			t6 = space();
    			div3 = element("div");
    			a3 = element("a");
    			i3 = element("i");
    			t7 = text(" Perfil");
    			t8 = space();
    			a4 = element("a");
    			i4 = element("i");
    			t9 = text(" Principal");
    			t10 = space();
    			div2 = element("div");
    			t11 = space();
    			a5 = element("a");
    			t12 = text("Configurações e Privacidade");
    			t13 = space();
    			a6 = element("a");
    			t14 = text("Ajuda");
    			t15 = space();
    			a7 = element("a");
    			t16 = text("Sair");
    			this.h();
    		},
    		l: function claim(nodes) {
    			nav = claim_element(nodes, "NAV", { class: true, style: true });
    			var nav_nodes = children(nav);
    			a0 = claim_element(nav_nodes, "A", { class: true, href: true });
    			var a0_nodes = children(a0);
    			i0 = claim_element(a0_nodes, "I", { class: true });
    			children(i0).forEach(detach_dev);
    			a0_nodes.forEach(detach_dev);
    			t0 = claim_space(nav_nodes);
    			form = claim_element(nav_nodes, "FORM", { class: true });
    			var form_nodes = children(form);
    			div1 = claim_element(form_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);

    			input = claim_element(div1_nodes, "INPUT", {
    				type: true,
    				class: true,
    				placeholder: true,
    				"aria-label": true
    			});

    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			button = claim_element(div0_nodes, "BUTTON", { class: true, type: true });
    			var button_nodes = children(button);
    			i1 = claim_element(button_nodes, "I", { class: true, "data-feather": true });
    			children(i1).forEach(detach_dev);
    			button_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			t2 = claim_space(nav_nodes);
    			div4 = claim_element(nav_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			ul = claim_element(div4_nodes, "UL", { class: true });
    			var ul_nodes = children(ul);
    			li = claim_element(ul_nodes, "LI", { class: true });
    			var li_nodes = children(li);

    			a1 = claim_element(li_nodes, "A", {
    				class: true,
    				href: true,
    				"data-toggle": true
    			});

    			var a1_nodes = children(a1);
    			i2 = claim_element(a1_nodes, "I", { class: true, "data-feather": true });
    			children(i2).forEach(detach_dev);
    			a1_nodes.forEach(detach_dev);
    			t3 = claim_space(li_nodes);

    			a2 = claim_element(li_nodes, "A", {
    				class: true,
    				href: true,
    				"data-toggle": true
    			});

    			var a2_nodes = children(a2);
    			img = claim_element(a2_nodes, "IMG", { src: true, class: true, alt: true });
    			t4 = claim_space(a2_nodes);
    			span = claim_element(a2_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t5 = claim_text(span_nodes, t5_value);
    			span_nodes.forEach(detach_dev);
    			a2_nodes.forEach(detach_dev);
    			t6 = claim_space(li_nodes);
    			div3 = claim_element(li_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			a3 = claim_element(div3_nodes, "A", { class: true, href: true });
    			var a3_nodes = children(a3);
    			i3 = claim_element(a3_nodes, "I", { class: true, "data-feather": true });
    			children(i3).forEach(detach_dev);
    			t7 = claim_text(a3_nodes, " Perfil");
    			a3_nodes.forEach(detach_dev);
    			t8 = claim_space(div3_nodes);
    			a4 = claim_element(div3_nodes, "A", { class: true, href: true });
    			var a4_nodes = children(a4);
    			i4 = claim_element(a4_nodes, "I", { class: true, "data-feather": true });
    			children(i4).forEach(detach_dev);
    			t9 = claim_text(a4_nodes, " Principal");
    			a4_nodes.forEach(detach_dev);
    			t10 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			children(div2).forEach(detach_dev);
    			t11 = claim_space(div3_nodes);
    			a5 = claim_element(div3_nodes, "A", { class: true, href: true });
    			var a5_nodes = children(a5);
    			t12 = claim_text(a5_nodes, "Configurações e Privacidade");
    			a5_nodes.forEach(detach_dev);
    			t13 = claim_space(div3_nodes);
    			a6 = claim_element(div3_nodes, "A", { class: true, href: true });
    			var a6_nodes = children(a6);
    			t14 = claim_text(a6_nodes, "Ajuda");
    			a6_nodes.forEach(detach_dev);
    			t15 = claim_space(div3_nodes);
    			a7 = claim_element(div3_nodes, "A", { class: true, href: true });
    			var a7_nodes = children(a7);
    			t16 = claim_text(a7_nodes, "Sair");
    			a7_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			li_nodes.forEach(detach_dev);
    			ul_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			nav_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(i0, "class", "hamburger align-self-center");
    			add_location(i0, file$a, 18, 4, 442);
    			attr_dev(a0, "class", "sidebar-toggle");
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$a, 17, 2, 401);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "class", "form-control");
    			attr_dev(input, "placeholder", "Pesquisar");
    			attr_dev(input, "aria-label", "Search");
    			add_location(input, file$a, 23, 6, 594);
    			attr_dev(i1, "class", "align-middle");
    			attr_dev(i1, "data-feather", "search");
    			add_location(i1, file$a, 31, 10, 819);
    			attr_dev(button, "class", "btn");
    			attr_dev(button, "type", "button");
    			add_location(button, file$a, 30, 8, 773);
    			attr_dev(div0, "class", "input-group-append");
    			add_location(div0, file$a, 29, 6, 731);
    			attr_dev(div1, "class", "input-group input-group-navbar");
    			add_location(div1, file$a, 22, 4, 542);
    			attr_dev(form, "class", "d-none d-sm-inline-block");
    			add_location(form, file$a, 21, 2, 497);
    			attr_dev(i2, "class", "align-middle");
    			attr_dev(i2, "data-feather", "settings");
    			add_location(i2, file$a, 144, 10, 5110);
    			attr_dev(a1, "class", "nav-icon dropdown-toggle d-inline-block d-sm-none");
    			attr_dev(a1, "href", "/");
    			attr_dev(a1, "data-toggle", "dropdown");
    			add_location(a1, file$a, 139, 8, 4962);
    			if (!src_url_equal(img.src, img_src_value = /*user*/ ctx[0].dp)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "class", "avatar img-fluid rounded-circle mr-1");
    			attr_dev(img, "alt", img_alt_value = /*user*/ ctx[0].instagram);
    			add_location(img, file$a, 152, 10, 5334);
    			attr_dev(span, "class", "text-dark");
    			add_location(span, file$a, 156, 13, 5472);
    			attr_dev(a2, "class", "nav-link dropdown-toggle d-none d-sm-inline-block");
    			attr_dev(a2, "href", "/");
    			attr_dev(a2, "data-toggle", "dropdown");
    			add_location(a2, file$a, 147, 8, 5186);
    			attr_dev(i3, "class", "align-middle mr-1");
    			attr_dev(i3, "data-feather", "user");
    			add_location(i3, file$a, 160, 13, 5666);
    			attr_dev(a3, "class", "dropdown-item");
    			attr_dev(a3, "href", a3_href_value = "/" + /*user*/ ctx[0].instagram);
    			add_location(a3, file$a, 159, 10, 5602);
    			attr_dev(i4, "class", "align-middle mr-1");
    			attr_dev(i4, "data-feather", "pie-chart");
    			add_location(i4, file$a, 163, 13, 5809);
    			attr_dev(a4, "class", "dropdown-item");
    			attr_dev(a4, "href", "/dashboard");
    			add_location(a4, file$a, 162, 10, 5752);
    			attr_dev(div2, "class", "dropdown-divider");
    			add_location(div2, file$a, 165, 10, 5903);
    			attr_dev(a5, "class", "dropdown-item");
    			attr_dev(a5, "href", "/settings");
    			add_location(a5, file$a, 166, 10, 5947);
    			attr_dev(a6, "class", "dropdown-item");
    			attr_dev(a6, "href", "/copyright");
    			add_location(a6, file$a, 169, 10, 6058);
    			attr_dev(a7, "class", "dropdown-item");
    			attr_dev(a7, "href", "/");
    			add_location(a7, file$a, 170, 10, 6122);
    			attr_dev(div3, "class", "dropdown-menu dropdown-menu-right");
    			add_location(div3, file$a, 158, 8, 5543);
    			attr_dev(li, "class", "nav-item dropdown");
    			add_location(li, file$a, 138, 6, 4922);
    			attr_dev(ul, "class", "navbar-nav navbar-align");
    			add_location(ul, file$a, 38, 4, 973);
    			attr_dev(div4, "class", "navbar-collapse collapse");
    			add_location(div4, file$a, 37, 2, 929);
    			attr_dev(nav, "class", "navbar navbar-expand navbar-light navbar-bg svelte-vii5px");
    			attr_dev(nav, "style", /*cssVarStyles*/ ctx[1]);
    			add_location(nav, file$a, 16, 0, 317);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav, anchor);
    			append_hydration_dev(nav, a0);
    			append_hydration_dev(a0, i0);
    			append_hydration_dev(nav, t0);
    			append_hydration_dev(nav, form);
    			append_hydration_dev(form, div1);
    			append_hydration_dev(div1, input);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, button);
    			append_hydration_dev(button, i1);
    			append_hydration_dev(nav, t2);
    			append_hydration_dev(nav, div4);
    			append_hydration_dev(div4, ul);
    			append_hydration_dev(ul, li);
    			append_hydration_dev(li, a1);
    			append_hydration_dev(a1, i2);
    			append_hydration_dev(li, t3);
    			append_hydration_dev(li, a2);
    			append_hydration_dev(a2, img);
    			append_hydration_dev(a2, t4);
    			append_hydration_dev(a2, span);
    			append_hydration_dev(span, t5);
    			append_hydration_dev(li, t6);
    			append_hydration_dev(li, div3);
    			append_hydration_dev(div3, a3);
    			append_hydration_dev(a3, i3);
    			append_hydration_dev(a3, t7);
    			append_hydration_dev(div3, t8);
    			append_hydration_dev(div3, a4);
    			append_hydration_dev(a4, i4);
    			append_hydration_dev(a4, t9);
    			append_hydration_dev(div3, t10);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div3, t11);
    			append_hydration_dev(div3, a5);
    			append_hydration_dev(a5, t12);
    			append_hydration_dev(div3, t13);
    			append_hydration_dev(div3, a6);
    			append_hydration_dev(a6, t14);
    			append_hydration_dev(div3, t15);
    			append_hydration_dev(div3, a7);
    			append_hydration_dev(a7, t16);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*user*/ 1 && !src_url_equal(img.src, img_src_value = /*user*/ ctx[0].dp)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*user*/ 1 && img_alt_value !== (img_alt_value = /*user*/ ctx[0].instagram)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*user*/ 1 && t5_value !== (t5_value = /*user*/ ctx[0].instagram + "")) set_data_dev(t5, t5_value);

    			if (dirty & /*user*/ 1 && a3_href_value !== (a3_href_value = "/" + /*user*/ ctx[0].instagram)) {
    				attr_dev(a3, "href", a3_href_value);
    			}

    			if (dirty & /*cssVarStyles*/ 2) {
    				attr_dev(nav, "style", /*cssVarStyles*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let cssVarStyles;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Navbar', slots, []);
    	let { user } = $$props;
    	let styles = { 'header_color': user.style.header_color };
    	const writable_props = ['user'];

    	Object_1$3.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Navbar> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('user' in $$props) $$invalidate(0, user = $$props.user);
    	};

    	$$self.$capture_state = () => ({ user, styles, cssVarStyles });

    	$$self.$inject_state = $$props => {
    		if ('user' in $$props) $$invalidate(0, user = $$props.user);
    		if ('styles' in $$props) $$invalidate(2, styles = $$props.styles);
    		if ('cssVarStyles' in $$props) $$invalidate(1, cssVarStyles = $$props.cssVarStyles);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$invalidate(1, cssVarStyles = Object.entries(styles).map(([key, value]) => `--${key}:${value}`).join(';'));
    	return [user, cssVarStyles];
    }

    class Navbar extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, safe_not_equal, { user: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Navbar",
    			options,
    			id: create_fragment$a.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*user*/ ctx[0] === undefined && !('user' in props)) {
    			console.warn("<Navbar> was created without expected prop 'user'");
    		}
    	}

    	get user() {
    		throw new Error("<Navbar>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set user(value) {
    		throw new Error("<Navbar>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Dashboard.svelte generated by Svelte v3.47.0 */

    const { Object: Object_1$2, console: console_1$6 } = globals;
    const file$9 = "src\\pages\\Dashboard.svelte";

    function get_each_context$4(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	return child_ctx;
    }

    // (386:14) {:else}
    function create_else_block_1(ctx) {
    	let div;
    	let img;
    	let img_src_value;
    	let t0;
    	let h1;
    	let t1;
    	let t2;
    	let a;
    	let t3;
    	let t4;

    	const block = {
    		c: function create() {
    			div = element("div");
    			img = element("img");
    			t0 = space();
    			h1 = element("h1");
    			t1 = text("Crie seu primeiro Produto ou Serviço");
    			t2 = space();
    			a = element("a");
    			t3 = text("Criar");
    			t4 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { style: true });
    			var div_nodes = children(div);
    			img = claim_element(div_nodes, "IMG", { alt: true, src: true, width: true });
    			t0 = claim_space(div_nodes);
    			h1 = claim_element(div_nodes, "H1", {});
    			var h1_nodes = children(h1);
    			t1 = claim_text(h1_nodes, "Crie seu primeiro Produto ou Serviço");
    			h1_nodes.forEach(detach_dev);
    			t2 = claim_space(div_nodes);
    			a = claim_element(div_nodes, "A", { href: true, class: true });
    			var a_nodes = children(a);
    			t3 = claim_text(a_nodes, "Criar");
    			a_nodes.forEach(detach_dev);
    			t4 = claim_space(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "alt", "");
    			if (!src_url_equal(img.src, img_src_value = "img/upload.png")) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "width", "300px");
    			add_location(img, file$9, 389, 18, 14307);
    			add_location(h1, file$9, 390, 18, 14376);
    			attr_dev(a, "href", "/addlink");
    			attr_dev(a, "class", "btn btn-primary svelte-10c3svd");
    			add_location(a, file$9, 391, 18, 14441);
    			set_style(div, "display", "flex");
    			set_style(div, "flex-direction", "column");
    			set_style(div, "justify-content", "center");
    			set_style(div, "align-items", "center");
    			add_location(div, file$9, 386, 16, 14160);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, img);
    			append_hydration_dev(div, t0);
    			append_hydration_dev(div, h1);
    			append_hydration_dev(h1, t1);
    			append_hydration_dev(div, t2);
    			append_hydration_dev(div, a);
    			append_hydration_dev(a, t3);
    			append_hydration_dev(div, t4);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(386:14) {:else}",
    		ctx
    	});

    	return block;
    }

    // (355:16) {:else}
    function create_else_block$5(ctx) {
    	let div1;
    	let div0;
    	let small0;
    	let t0_value = moment(/*link*/ ctx[25].created_date).startOf("hour").fromNow() + "";
    	let t0;
    	let t1;
    	let p0;
    	let strong;
    	let t2_value = /*link*/ ctx[25].title + "";
    	let t2;
    	let t3;
    	let p1;
    	let t4_value = /*link*/ ctx[25].description + "";
    	let t4;
    	let t5;
    	let small1;
    	let t6_value = moment(/*link*/ ctx[25].created_date).calendar() + "";
    	let t6;
    	let br;
    	let t7;
    	let a0;
    	let t8;
    	let a0_href_value;
    	let t9;
    	let a1;
    	let t10;
    	let a1_href_value;
    	let t11;
    	let button;
    	let t12;
    	let mounted;
    	let dispose;

    	function click_handler_2() {
    		return /*click_handler_2*/ ctx[20](/*link*/ ctx[25]);
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			small0 = element("small");
    			t0 = text(t0_value);
    			t1 = space();
    			p0 = element("p");
    			strong = element("strong");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			small1 = element("small");
    			t6 = text(t6_value);
    			br = element("br");
    			t7 = space();
    			a0 = element("a");
    			t8 = text("Go to link");
    			t9 = space();
    			a1 = element("a");
    			t10 = text("Edit");
    			t11 = space();
    			button = element("button");
    			t12 = text("Delete");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			small0 = claim_element(div0_nodes, "SMALL", { class: true });
    			var small0_nodes = children(small0);
    			t0 = claim_text(small0_nodes, t0_value);
    			small0_nodes.forEach(detach_dev);
    			t1 = claim_space(div0_nodes);
    			p0 = claim_element(div0_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			strong = claim_element(p0_nodes, "STRONG", {});
    			var strong_nodes = children(strong);
    			t2 = claim_text(strong_nodes, t2_value);
    			strong_nodes.forEach(detach_dev);
    			p0_nodes.forEach(detach_dev);
    			t3 = claim_space(div0_nodes);
    			p1 = claim_element(div0_nodes, "P", {});
    			var p1_nodes = children(p1);
    			t4 = claim_text(p1_nodes, t4_value);
    			p1_nodes.forEach(detach_dev);
    			t5 = claim_space(div0_nodes);
    			small1 = claim_element(div0_nodes, "SMALL", { class: true });
    			var small1_nodes = children(small1);
    			t6 = claim_text(small1_nodes, t6_value);
    			small1_nodes.forEach(detach_dev);
    			br = claim_element(div0_nodes, "BR", {});
    			t7 = claim_space(div0_nodes);
    			a0 = claim_element(div0_nodes, "A", { href: true, class: true });
    			var a0_nodes = children(a0);
    			t8 = claim_text(a0_nodes, "Go to link");
    			a0_nodes.forEach(detach_dev);
    			t9 = claim_space(div0_nodes);
    			a1 = claim_element(div0_nodes, "A", { href: true, class: true });
    			var a1_nodes = children(a1);
    			t10 = claim_text(a1_nodes, "Edit");
    			a1_nodes.forEach(detach_dev);
    			t11 = claim_space(div0_nodes);
    			button = claim_element(div0_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			t12 = claim_text(button_nodes, "Delete");
    			button_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(small0, "class", "float-right text-navy");
    			add_location(small0, file$9, 357, 22, 12959);
    			add_location(strong, file$9, 362, 38, 13203);
    			attr_dev(p0, "class", "mb-2");
    			add_location(p0, file$9, 362, 22, 13187);
    			add_location(p1, file$9, 363, 22, 13260);
    			attr_dev(small1, "class", "text-muted");
    			add_location(small1, file$9, 366, 22, 13359);
    			add_location(br, file$9, 368, 23, 13481);
    			attr_dev(a0, "href", a0_href_value = /*link*/ ctx[25].url);
    			attr_dev(a0, "class", "btn btn-sm btn-success mt-1 svelte-10c3svd");
    			add_location(a0, file$9, 369, 22, 13511);
    			attr_dev(a1, "href", a1_href_value = /*link*/ ctx[25].url);
    			attr_dev(a1, "class", "btn btn-sm btn-primary mt-1 svelte-10c3svd");
    			add_location(a1, file$9, 372, 22, 13654);
    			attr_dev(button, "class", "btn btn-sm btn-danger mt-1 svelte-10c3svd");
    			add_location(button, file$9, 375, 22, 13791);
    			attr_dev(div0, "class", "media-body");
    			add_location(div0, file$9, 356, 20, 12911);
    			attr_dev(div1, "class", "media");
    			add_location(div1, file$9, 355, 18, 12870);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, small0);
    			append_hydration_dev(small0, t0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, p0);
    			append_hydration_dev(p0, strong);
    			append_hydration_dev(strong, t2);
    			append_hydration_dev(div0, t3);
    			append_hydration_dev(div0, p1);
    			append_hydration_dev(p1, t4);
    			append_hydration_dev(div0, t5);
    			append_hydration_dev(div0, small1);
    			append_hydration_dev(small1, t6);
    			append_hydration_dev(div0, br);
    			append_hydration_dev(div0, t7);
    			append_hydration_dev(div0, a0);
    			append_hydration_dev(a0, t8);
    			append_hydration_dev(div0, t9);
    			append_hydration_dev(div0, a1);
    			append_hydration_dev(a1, t10);
    			append_hydration_dev(div0, t11);
    			append_hydration_dev(div0, button);
    			append_hydration_dev(button, t12);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", click_handler_2, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*user*/ 2 && t0_value !== (t0_value = moment(/*link*/ ctx[25].created_date).startOf("hour").fromNow() + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*user*/ 2 && t2_value !== (t2_value = /*link*/ ctx[25].title + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*user*/ 2 && t4_value !== (t4_value = /*link*/ ctx[25].description + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*user*/ 2 && t6_value !== (t6_value = moment(/*link*/ ctx[25].created_date).calendar() + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*user*/ 2 && a0_href_value !== (a0_href_value = /*link*/ ctx[25].url)) {
    				attr_dev(a0, "href", a0_href_value);
    			}

    			if (dirty & /*user*/ 2 && a1_href_value !== (a1_href_value = /*link*/ ctx[25].url)) {
    				attr_dev(a1, "href", a1_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$5.name,
    		type: "else",
    		source: "(355:16) {:else}",
    		ctx
    	});

    	return block;
    }

    // (310:16) {#if link.image != null && link.image != ""}
    function create_if_block$6(ctx) {
    	let div2;
    	let div1;
    	let small0;
    	let t0_value = moment(/*link*/ ctx[25].created_date).startOf("hour").fromNow() + "";
    	let t0;
    	let t1;
    	let p0;
    	let strong;
    	let t2_value = /*link*/ ctx[25].title + "";
    	let t2;
    	let t3;
    	let p1;
    	let t4_value = /*link*/ ctx[25].description + "";
    	let t4;
    	let t5;
    	let div0;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t6;
    	let small1;
    	let t7_value = moment(/*link*/ ctx[25].created_date).calendar() + "";
    	let t7;
    	let br;
    	let t8;
    	let a;
    	let t9;
    	let a_href_value;
    	let t10;
    	let button0;
    	let t11;
    	let t12;
    	let button1;
    	let t13;
    	let mounted;
    	let dispose;

    	function click_handler() {
    		return /*click_handler*/ ctx[18](/*link*/ ctx[25]);
    	}

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[19](/*link*/ ctx[25]);
    	}

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div1 = element("div");
    			small0 = element("small");
    			t0 = text(t0_value);
    			t1 = space();
    			p0 = element("p");
    			strong = element("strong");
    			t2 = text(t2_value);
    			t3 = space();
    			p1 = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			div0 = element("div");
    			img = element("img");
    			t6 = space();
    			small1 = element("small");
    			t7 = text(t7_value);
    			br = element("br");
    			t8 = space();
    			a = element("a");
    			t9 = text("Ir para página");
    			t10 = space();
    			button0 = element("button");
    			t11 = text("Editar");
    			t12 = space();
    			button1 = element("button");
    			t13 = text("Apagar");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div2 = claim_element(nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			small0 = claim_element(div1_nodes, "SMALL", { class: true });
    			var small0_nodes = children(small0);
    			t0 = claim_text(small0_nodes, t0_value);
    			small0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			p0 = claim_element(div1_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			strong = claim_element(p0_nodes, "STRONG", {});
    			var strong_nodes = children(strong);
    			t2 = claim_text(strong_nodes, t2_value);
    			strong_nodes.forEach(detach_dev);
    			p0_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			p1 = claim_element(div1_nodes, "P", {});
    			var p1_nodes = children(p1);
    			t4 = claim_text(p1_nodes, t4_value);
    			p1_nodes.forEach(detach_dev);
    			t5 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);

    			img = claim_element(div0_nodes, "IMG", {
    				src: true,
    				style: true,
    				height: true,
    				alt: true
    			});

    			div0_nodes.forEach(detach_dev);
    			t6 = claim_space(div1_nodes);
    			small1 = claim_element(div1_nodes, "SMALL", { class: true });
    			var small1_nodes = children(small1);
    			t7 = claim_text(small1_nodes, t7_value);
    			small1_nodes.forEach(detach_dev);
    			br = claim_element(div1_nodes, "BR", {});
    			t8 = claim_space(div1_nodes);
    			a = claim_element(div1_nodes, "A", { href: true, class: true });
    			var a_nodes = children(a);
    			t9 = claim_text(a_nodes, "Ir para página");
    			a_nodes.forEach(detach_dev);
    			t10 = claim_space(div1_nodes);
    			button0 = claim_element(div1_nodes, "BUTTON", { class: true });
    			var button0_nodes = children(button0);
    			t11 = claim_text(button0_nodes, "Editar");
    			button0_nodes.forEach(detach_dev);
    			t12 = claim_space(div1_nodes);
    			button1 = claim_element(div1_nodes, "BUTTON", { class: true });
    			var button1_nodes = children(button1);
    			t13 = claim_text(button1_nodes, "Apagar");
    			button1_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(small0, "class", "float-right text-navy");
    			add_location(small0, file$9, 312, 22, 11163);
    			add_location(strong, file$9, 317, 38, 11407);
    			attr_dev(p0, "class", "mb-2");
    			add_location(p0, file$9, 317, 22, 11391);
    			add_location(p1, file$9, 318, 22, 11464);
    			if (!src_url_equal(img.src, img_src_value = /*link*/ ctx[25].image)) attr_dev(img, "src", img_src_value);
    			set_style(img, "margin", "10px");
    			attr_dev(img, "height", "200px");
    			attr_dev(img, "alt", img_alt_value = /*link*/ ctx[25].title);
    			add_location(img, file$9, 326, 24, 11734);
    			attr_dev(div0, "class", "row no-gutters mt-1");
    			set_style(div0, "display", "flex");
    			set_style(div0, "flex-wrap", "wrap");
    			add_location(div0, file$9, 322, 22, 11565);
    			attr_dev(small1, "class", "text-muted");
    			add_location(small1, file$9, 334, 22, 11999);
    			add_location(br, file$9, 336, 23, 12121);
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[25].url);
    			attr_dev(a, "class", "btn btn-sm btn-success mt-1 svelte-10c3svd");
    			add_location(a, file$9, 337, 22, 12151);
    			attr_dev(button0, "class", "btn btn-sm btn-primary mt-1 svelte-10c3svd");
    			add_location(button0, file$9, 340, 22, 12298);
    			attr_dev(button1, "class", "btn btn-sm btn-danger mt-1 svelte-10c3svd");
    			add_location(button1, file$9, 346, 22, 12544);
    			attr_dev(div1, "class", "media-body");
    			add_location(div1, file$9, 311, 20, 11115);
    			attr_dev(div2, "class", "media");
    			add_location(div2, file$9, 310, 18, 11074);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div2, anchor);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, small0);
    			append_hydration_dev(small0, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, p0);
    			append_hydration_dev(p0, strong);
    			append_hydration_dev(strong, t2);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div1, p1);
    			append_hydration_dev(p1, t4);
    			append_hydration_dev(div1, t5);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, img);
    			append_hydration_dev(div1, t6);
    			append_hydration_dev(div1, small1);
    			append_hydration_dev(small1, t7);
    			append_hydration_dev(div1, br);
    			append_hydration_dev(div1, t8);
    			append_hydration_dev(div1, a);
    			append_hydration_dev(a, t9);
    			append_hydration_dev(div1, t10);
    			append_hydration_dev(div1, button0);
    			append_hydration_dev(button0, t11);
    			append_hydration_dev(div1, t12);
    			append_hydration_dev(div1, button1);
    			append_hydration_dev(button1, t13);

    			if (!mounted) {
    				dispose = [
    					listen_dev(button0, "click", click_handler, false, false, false),
    					listen_dev(button1, "click", click_handler_1, false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*user*/ 2 && t0_value !== (t0_value = moment(/*link*/ ctx[25].created_date).startOf("hour").fromNow() + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*user*/ 2 && t2_value !== (t2_value = /*link*/ ctx[25].title + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*user*/ 2 && t4_value !== (t4_value = /*link*/ ctx[25].description + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*user*/ 2 && !src_url_equal(img.src, img_src_value = /*link*/ ctx[25].image)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*user*/ 2 && img_alt_value !== (img_alt_value = /*link*/ ctx[25].title)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*user*/ 2 && t7_value !== (t7_value = moment(/*link*/ ctx[25].created_date).calendar() + "")) set_data_dev(t7, t7_value);

    			if (dirty & /*user*/ 2 && a_href_value !== (a_href_value = /*link*/ ctx[25].url)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(310:16) {#if link.image != null && link.image != \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    // (309:14) {#each user.links as link}
    function create_each_block$4(ctx) {
    	let t;
    	let hr;

    	function select_block_type(ctx, dirty) {
    		if (/*link*/ ctx[25].image != null && /*link*/ ctx[25].image != "") return create_if_block$6;
    		return create_else_block$5;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			t = space();
    			hr = element("hr");
    			this.h();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			t = claim_space(nodes);
    			hr = claim_element(nodes, "HR", {});
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(hr, file$9, 384, 16, 14113);
    		},
    		m: function mount(target, anchor) {
    			if_block.m(target, anchor);
    			insert_hydration_dev(target, t, anchor);
    			insert_hydration_dev(target, hr, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(t.parentNode, t);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			if (detaching) detach_dev(hr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$4.name,
    		type: "each",
    		source: "(309:14) {#each user.links as link}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div40;
    	let navbar;
    	let t0;
    	let main;
    	let div39;
    	let div38;
    	let div21;
    	let div4;
    	let div3;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t1;
    	let h4;
    	let t2_value = /*user*/ ctx[1].instagram + "";
    	let t2;
    	let t3;
    	let input0;
    	let input0_value_value;
    	let t4;
    	let div0;
    	let button;
    	let span0;
    	let t5;
    	let t6;
    	let t7;
    	let div1;
    	let t8;
    	let t9_value = (/*user*/ ctx[1].total_links || 0) + "";
    	let t9;
    	let t10;
    	let div2;
    	let a0;
    	let t11;
    	let t12;
    	let a1;
    	let t13;
    	let t14;
    	let a2;
    	let span1;
    	let t15;
    	let a2_href_value;
    	let t16;
    	let div14;
    	let div8;
    	let div7;
    	let div6;
    	let a3;
    	let i0;
    	let t17;
    	let div5;
    	let a4;
    	let t18;
    	let t19;
    	let h50;
    	let t20;
    	let t21;
    	let div13;
    	let div10;
    	let div9;
    	let p0;
    	let strong0;
    	let t22;
    	let t23;
    	let p1;
    	let t24_value = /*user*/ ctx[1].views + "";
    	let t24;
    	let t25;
    	let hr0;
    	let t26;
    	let div12;
    	let div11;
    	let p2;
    	let strong1;
    	let t27;
    	let t28;
    	let p3;
    	let t29;
    	let t30;
    	let hr1;
    	let t31;
    	let div20;
    	let div18;
    	let div17;
    	let div16;
    	let a5;
    	let i1;
    	let t32;
    	let div15;
    	let a6;
    	let t33;
    	let t34;
    	let h51;
    	let t35;
    	let t36;
    	let div19;
    	let label0;
    	let input1;
    	let t37;
    	let t38;
    	let label1;
    	let input2;
    	let t39;
    	let t40;
    	let label2;
    	let input3;
    	let t41;
    	let t42;
    	let label3;
    	let input4;
    	let t43;
    	let t44;
    	let div34;
    	let div27;
    	let div25;
    	let div24;
    	let div23;
    	let a7;
    	let i2;
    	let t45;
    	let div22;
    	let a8;
    	let t46;
    	let t47;
    	let h52;
    	let t48;
    	let t49;
    	let div26;
    	let label4;
    	let input5;
    	let t50;
    	let t51;
    	let label5;
    	let input6;
    	let t52;
    	let t53;
    	let label6;
    	let input7;
    	let t54;
    	let t55;
    	let label7;
    	let input8;
    	let t56;
    	let t57;
    	let div33;
    	let div31;
    	let div30;
    	let div29;
    	let a9;
    	let i3;
    	let t58;
    	let div28;
    	let a10;
    	let t59;
    	let t60;
    	let h53;
    	let t61;
    	let t62;
    	let div32;
    	let label8;
    	let input9;
    	let t63;
    	let t64;
    	let label9;
    	let input10;
    	let t65;
    	let t66;
    	let label10;
    	let input11;
    	let t67;
    	let t68;
    	let label11;
    	let input12;
    	let t69;
    	let t70;
    	let div37;
    	let div36;
    	let div35;
    	let t71;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;

    	navbar = new Navbar({
    			props: { user: /*user*/ ctx[1] },
    			$$inline: true
    		});

    	let each_value = /*user*/ ctx[1].links;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$4(get_each_context$4(ctx, each_value, i));
    	}

    	let each_1_else = null;

    	if (!each_value.length) {
    		each_1_else = create_else_block_1(ctx);
    	}

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div40 = element("div");
    			create_component(navbar.$$.fragment);
    			t0 = space();
    			main = element("main");
    			div39 = element("div");
    			div38 = element("div");
    			div21 = element("div");
    			div4 = element("div");
    			div3 = element("div");
    			img = element("img");
    			t1 = space();
    			h4 = element("h4");
    			t2 = text(t2_value);
    			t3 = space();
    			input0 = element("input");
    			t4 = space();
    			div0 = element("div");
    			button = element("button");
    			span0 = element("span");
    			t5 = text("Copiar Link");
    			t6 = text("\r\n                  Copiar");
    			t7 = space();
    			div1 = element("div");
    			t8 = text("Total de Produtos e Serviços oferecidos : ");
    			t9 = text(t9_value);
    			t10 = space();
    			div2 = element("div");
    			a0 = element("a");
    			t11 = text("Adicionar Produto/Serviço");
    			t12 = space();
    			a1 = element("a");
    			t13 = text("Adicionar Agenda");
    			t14 = space();
    			a2 = element("a");
    			span1 = element("span");
    			t15 = text(" Instagram");
    			t16 = space();
    			div14 = element("div");
    			div8 = element("div");
    			div7 = element("div");
    			div6 = element("div");
    			a3 = element("a");
    			i0 = element("i");
    			t17 = space();
    			div5 = element("div");
    			a4 = element("a");
    			t18 = text("View all");
    			t19 = space();
    			h50 = element("h5");
    			t20 = text("Estatísticas");
    			t21 = space();
    			div13 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			p0 = element("p");
    			strong0 = element("strong");
    			t22 = text("Total de visitas");
    			t23 = space();
    			p1 = element("p");
    			t24 = text(t24_value);
    			t25 = space();
    			hr0 = element("hr");
    			t26 = space();
    			div12 = element("div");
    			div11 = element("div");
    			p2 = element("p");
    			strong1 = element("strong");
    			t27 = text("Total de Cliques");
    			t28 = space();
    			p3 = element("p");
    			t29 = text(/*clicks*/ ctx[2]);
    			t30 = space();
    			hr1 = element("hr");
    			t31 = space();
    			div20 = element("div");
    			div18 = element("div");
    			div17 = element("div");
    			div16 = element("div");
    			a5 = element("a");
    			i1 = element("i");
    			t32 = space();
    			div15 = element("div");
    			a6 = element("a");
    			t33 = text("Dashboard");
    			t34 = space();
    			h51 = element("h5");
    			t35 = text("Configurações");
    			t36 = space();
    			div19 = element("div");
    			label0 = element("label");
    			input1 = element("input");
    			t37 = text(" \r\n                Primária");
    			t38 = space();
    			label1 = element("label");
    			input2 = element("input");
    			t39 = text(" \r\n                Secundária");
    			t40 = space();
    			label2 = element("label");
    			input3 = element("input");
    			t41 = text(" \r\n                Alerta");
    			t42 = space();
    			label3 = element("label");
    			input4 = element("input");
    			t43 = text(" \r\n                Cabeçalho");
    			t44 = space();
    			div34 = element("div");
    			div27 = element("div");
    			div25 = element("div");
    			div24 = element("div");
    			div23 = element("div");
    			a7 = element("a");
    			i2 = element("i");
    			t45 = space();
    			div22 = element("div");
    			a8 = element("a");
    			t46 = text("Dashboard");
    			t47 = space();
    			h52 = element("h5");
    			t48 = text("Pendências");
    			t49 = space();
    			div26 = element("div");
    			label4 = element("label");
    			input5 = element("input");
    			t50 = text(" \r\n                Primária");
    			t51 = space();
    			label5 = element("label");
    			input6 = element("input");
    			t52 = text(" \r\n                Secundária");
    			t53 = space();
    			label6 = element("label");
    			input7 = element("input");
    			t54 = text(" \r\n                Alerta");
    			t55 = space();
    			label7 = element("label");
    			input8 = element("input");
    			t56 = text(" \r\n                Cabeçalho");
    			t57 = space();
    			div33 = element("div");
    			div31 = element("div");
    			div30 = element("div");
    			div29 = element("div");
    			a9 = element("a");
    			i3 = element("i");
    			t58 = space();
    			div28 = element("div");
    			a10 = element("a");
    			t59 = text("Dashboard");
    			t60 = space();
    			h53 = element("h5");
    			t61 = text("Próximos Agendamentos");
    			t62 = space();
    			div32 = element("div");
    			label8 = element("label");
    			input9 = element("input");
    			t63 = text(" \r\n                Primária");
    			t64 = space();
    			label9 = element("label");
    			input10 = element("input");
    			t65 = text(" \r\n                Secundária");
    			t66 = space();
    			label10 = element("label");
    			input11 = element("input");
    			t67 = text(" \r\n                Alerta");
    			t68 = space();
    			label11 = element("label");
    			input12 = element("input");
    			t69 = text(" \r\n                Cabeçalho");
    			t70 = space();
    			div37 = element("div");
    			div36 = element("div");
    			div35 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			if (each_1_else) {
    				each_1_else.c();
    			}

    			t71 = space();
    			create_component(footer.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div40 = claim_element(nodes, "DIV", { class: true, style: true });
    			var div40_nodes = children(div40);
    			claim_component(navbar.$$.fragment, div40_nodes);
    			t0 = claim_space(div40_nodes);
    			main = claim_element(div40_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div39 = claim_element(main_nodes, "DIV", { class: true });
    			var div39_nodes = children(div39);
    			div38 = claim_element(div39_nodes, "DIV", { class: true });
    			var div38_nodes = children(div38);
    			div21 = claim_element(div38_nodes, "DIV", { class: true });
    			var div21_nodes = children(div21);
    			div4 = claim_element(div21_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);

    			img = claim_element(div3_nodes, "IMG", {
    				src: true,
    				alt: true,
    				class: true,
    				width: true,
    				height: true
    			});

    			t1 = claim_space(div3_nodes);
    			h4 = claim_element(div3_nodes, "H4", { class: true });
    			var h4_nodes = children(h4);
    			t2 = claim_text(h4_nodes, t2_value);
    			h4_nodes.forEach(detach_dev);
    			t3 = claim_space(div3_nodes);
    			input0 = claim_element(div3_nodes, "INPUT", { type: true, id: true, style: true });
    			t4 = claim_space(div3_nodes);
    			div0 = claim_element(div3_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			button = claim_element(div0_nodes, "BUTTON", { class: true });
    			var button_nodes = children(button);
    			span0 = claim_element(button_nodes, "SPAN", { class: true, id: true });
    			var span0_nodes = children(span0);
    			t5 = claim_text(span0_nodes, "Copiar Link");
    			span0_nodes.forEach(detach_dev);
    			t6 = claim_text(button_nodes, "\r\n                  Copiar");
    			button_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t7 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t8 = claim_text(div1_nodes, "Total de Produtos e Serviços oferecidos : ");
    			t9 = claim_text(div1_nodes, t9_value);
    			div1_nodes.forEach(detach_dev);
    			t10 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", {});
    			var div2_nodes = children(div2);
    			a0 = claim_element(div2_nodes, "A", { class: true, replace: true, href: true });
    			var a0_nodes = children(a0);
    			t11 = claim_text(a0_nodes, "Adicionar Produto/Serviço");
    			a0_nodes.forEach(detach_dev);
    			t12 = claim_space(div2_nodes);
    			a1 = claim_element(div2_nodes, "A", { class: true, replace: true, href: true });
    			var a1_nodes = children(a1);
    			t13 = claim_text(a1_nodes, "Adicionar Agenda");
    			a1_nodes.forEach(detach_dev);
    			t14 = claim_space(div2_nodes);
    			a2 = claim_element(div2_nodes, "A", { class: true, target: true, href: true });
    			var a2_nodes = children(a2);
    			span1 = claim_element(a2_nodes, "SPAN", { "data-feather": true });
    			children(span1).forEach(detach_dev);
    			t15 = claim_text(a2_nodes, " Instagram");
    			a2_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t16 = claim_space(div21_nodes);
    			div14 = claim_element(div21_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div8 = claim_element(div14_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);

    			a3 = claim_element(div6_nodes, "A", {
    				href: true,
    				"data-toggle": true,
    				"data-display": true
    			});

    			var a3_nodes = children(a3);
    			i0 = claim_element(a3_nodes, "I", { class: true, "data-feather": true });
    			children(i0).forEach(detach_dev);
    			a3_nodes.forEach(detach_dev);
    			t17 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			a4 = claim_element(div5_nodes, "A", { class: true, href: true });
    			var a4_nodes = children(a4);
    			t18 = claim_text(a4_nodes, "View all");
    			a4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			t19 = claim_space(div8_nodes);
    			h50 = claim_element(div8_nodes, "H5", { class: true });
    			var h50_nodes = children(h50);
    			t20 = claim_text(h50_nodes, "Estatísticas");
    			h50_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			t21 = claim_space(div14_nodes);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div10 = claim_element(div13_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			p0 = claim_element(div9_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			strong0 = claim_element(p0_nodes, "STRONG", {});
    			var strong0_nodes = children(strong0);
    			t22 = claim_text(strong0_nodes, "Total de visitas");
    			strong0_nodes.forEach(detach_dev);
    			p0_nodes.forEach(detach_dev);
    			t23 = claim_space(div9_nodes);
    			p1 = claim_element(div9_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t24 = claim_text(p1_nodes, t24_value);
    			p1_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			t25 = claim_space(div13_nodes);
    			hr0 = claim_element(div13_nodes, "HR", { class: true });
    			t26 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			p2 = claim_element(div11_nodes, "P", { class: true });
    			var p2_nodes = children(p2);
    			strong1 = claim_element(p2_nodes, "STRONG", {});
    			var strong1_nodes = children(strong1);
    			t27 = claim_text(strong1_nodes, "Total de Cliques");
    			strong1_nodes.forEach(detach_dev);
    			p2_nodes.forEach(detach_dev);
    			t28 = claim_space(div11_nodes);
    			p3 = claim_element(div11_nodes, "P", { class: true });
    			var p3_nodes = children(p3);
    			t29 = claim_text(p3_nodes, /*clicks*/ ctx[2]);
    			p3_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			t30 = claim_space(div13_nodes);
    			hr1 = claim_element(div13_nodes, "HR", { class: true });
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			t31 = claim_space(div21_nodes);
    			div20 = claim_element(div21_nodes, "DIV", { class: true });
    			var div20_nodes = children(div20);
    			div18 = claim_element(div20_nodes, "DIV", { class: true });
    			var div18_nodes = children(div18);
    			div17 = claim_element(div18_nodes, "DIV", { class: true });
    			var div17_nodes = children(div17);
    			div16 = claim_element(div17_nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);

    			a5 = claim_element(div16_nodes, "A", {
    				href: true,
    				"data-toggle": true,
    				"data-display": true
    			});

    			var a5_nodes = children(a5);
    			i1 = claim_element(a5_nodes, "I", { class: true, "data-feather": true });
    			children(i1).forEach(detach_dev);
    			a5_nodes.forEach(detach_dev);
    			t32 = claim_space(div16_nodes);
    			div15 = claim_element(div16_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			a6 = claim_element(div15_nodes, "A", { class: true, href: true });
    			var a6_nodes = children(a6);
    			t33 = claim_text(a6_nodes, "Dashboard");
    			a6_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			div16_nodes.forEach(detach_dev);
    			div17_nodes.forEach(detach_dev);
    			t34 = claim_space(div18_nodes);
    			h51 = claim_element(div18_nodes, "H5", { class: true });
    			var h51_nodes = children(h51);
    			t35 = claim_text(h51_nodes, "Configurações");
    			h51_nodes.forEach(detach_dev);
    			div18_nodes.forEach(detach_dev);
    			t36 = claim_space(div20_nodes);
    			div19 = claim_element(div20_nodes, "DIV", { class: true });
    			var div19_nodes = children(div19);
    			label0 = claim_element(div19_nodes, "LABEL", {});
    			var label0_nodes = children(label0);
    			input1 = claim_element(label0_nodes, "INPUT", { style: true, type: true });
    			t37 = claim_text(label0_nodes, " \r\n                Primária");
    			label0_nodes.forEach(detach_dev);
    			t38 = claim_space(div19_nodes);
    			label1 = claim_element(div19_nodes, "LABEL", {});
    			var label1_nodes = children(label1);
    			input2 = claim_element(label1_nodes, "INPUT", { style: true, type: true });
    			t39 = claim_text(label1_nodes, " \r\n                Secundária");
    			label1_nodes.forEach(detach_dev);
    			t40 = claim_space(div19_nodes);
    			label2 = claim_element(div19_nodes, "LABEL", {});
    			var label2_nodes = children(label2);
    			input3 = claim_element(label2_nodes, "INPUT", { style: true, type: true });
    			t41 = claim_text(label2_nodes, " \r\n                Alerta");
    			label2_nodes.forEach(detach_dev);
    			t42 = claim_space(div19_nodes);
    			label3 = claim_element(div19_nodes, "LABEL", {});
    			var label3_nodes = children(label3);
    			input4 = claim_element(label3_nodes, "INPUT", { style: true, type: true });
    			t43 = claim_text(label3_nodes, " \r\n                Cabeçalho");
    			label3_nodes.forEach(detach_dev);
    			div19_nodes.forEach(detach_dev);
    			div20_nodes.forEach(detach_dev);
    			div21_nodes.forEach(detach_dev);
    			t44 = claim_space(div38_nodes);
    			div34 = claim_element(div38_nodes, "DIV", { class: true });
    			var div34_nodes = children(div34);
    			div27 = claim_element(div34_nodes, "DIV", { class: true });
    			var div27_nodes = children(div27);
    			div25 = claim_element(div27_nodes, "DIV", { class: true });
    			var div25_nodes = children(div25);
    			div24 = claim_element(div25_nodes, "DIV", { class: true });
    			var div24_nodes = children(div24);
    			div23 = claim_element(div24_nodes, "DIV", { class: true });
    			var div23_nodes = children(div23);

    			a7 = claim_element(div23_nodes, "A", {
    				href: true,
    				"data-toggle": true,
    				"data-display": true
    			});

    			var a7_nodes = children(a7);
    			i2 = claim_element(a7_nodes, "I", { class: true, "data-feather": true });
    			children(i2).forEach(detach_dev);
    			a7_nodes.forEach(detach_dev);
    			t45 = claim_space(div23_nodes);
    			div22 = claim_element(div23_nodes, "DIV", { class: true });
    			var div22_nodes = children(div22);
    			a8 = claim_element(div22_nodes, "A", { class: true, href: true });
    			var a8_nodes = children(a8);
    			t46 = claim_text(a8_nodes, "Dashboard");
    			a8_nodes.forEach(detach_dev);
    			div22_nodes.forEach(detach_dev);
    			div23_nodes.forEach(detach_dev);
    			div24_nodes.forEach(detach_dev);
    			t47 = claim_space(div25_nodes);
    			h52 = claim_element(div25_nodes, "H5", { class: true });
    			var h52_nodes = children(h52);
    			t48 = claim_text(h52_nodes, "Pendências");
    			h52_nodes.forEach(detach_dev);
    			div25_nodes.forEach(detach_dev);
    			t49 = claim_space(div27_nodes);
    			div26 = claim_element(div27_nodes, "DIV", { class: true });
    			var div26_nodes = children(div26);
    			label4 = claim_element(div26_nodes, "LABEL", {});
    			var label4_nodes = children(label4);
    			input5 = claim_element(label4_nodes, "INPUT", { style: true, type: true });
    			t50 = claim_text(label4_nodes, " \r\n                Primária");
    			label4_nodes.forEach(detach_dev);
    			t51 = claim_space(div26_nodes);
    			label5 = claim_element(div26_nodes, "LABEL", {});
    			var label5_nodes = children(label5);
    			input6 = claim_element(label5_nodes, "INPUT", { style: true, type: true });
    			t52 = claim_text(label5_nodes, " \r\n                Secundária");
    			label5_nodes.forEach(detach_dev);
    			t53 = claim_space(div26_nodes);
    			label6 = claim_element(div26_nodes, "LABEL", {});
    			var label6_nodes = children(label6);
    			input7 = claim_element(label6_nodes, "INPUT", { style: true, type: true });
    			t54 = claim_text(label6_nodes, " \r\n                Alerta");
    			label6_nodes.forEach(detach_dev);
    			t55 = claim_space(div26_nodes);
    			label7 = claim_element(div26_nodes, "LABEL", {});
    			var label7_nodes = children(label7);
    			input8 = claim_element(label7_nodes, "INPUT", { style: true, type: true });
    			t56 = claim_text(label7_nodes, " \r\n                Cabeçalho");
    			label7_nodes.forEach(detach_dev);
    			div26_nodes.forEach(detach_dev);
    			div27_nodes.forEach(detach_dev);
    			t57 = claim_space(div34_nodes);
    			div33 = claim_element(div34_nodes, "DIV", { class: true });
    			var div33_nodes = children(div33);
    			div31 = claim_element(div33_nodes, "DIV", { class: true });
    			var div31_nodes = children(div31);
    			div30 = claim_element(div31_nodes, "DIV", { class: true });
    			var div30_nodes = children(div30);
    			div29 = claim_element(div30_nodes, "DIV", { class: true });
    			var div29_nodes = children(div29);

    			a9 = claim_element(div29_nodes, "A", {
    				href: true,
    				"data-toggle": true,
    				"data-display": true
    			});

    			var a9_nodes = children(a9);
    			i3 = claim_element(a9_nodes, "I", { class: true, "data-feather": true });
    			children(i3).forEach(detach_dev);
    			a9_nodes.forEach(detach_dev);
    			t58 = claim_space(div29_nodes);
    			div28 = claim_element(div29_nodes, "DIV", { class: true });
    			var div28_nodes = children(div28);
    			a10 = claim_element(div28_nodes, "A", { class: true, href: true });
    			var a10_nodes = children(a10);
    			t59 = claim_text(a10_nodes, "Dashboard");
    			a10_nodes.forEach(detach_dev);
    			div28_nodes.forEach(detach_dev);
    			div29_nodes.forEach(detach_dev);
    			div30_nodes.forEach(detach_dev);
    			t60 = claim_space(div31_nodes);
    			h53 = claim_element(div31_nodes, "H5", { class: true });
    			var h53_nodes = children(h53);
    			t61 = claim_text(h53_nodes, "Próximos Agendamentos");
    			h53_nodes.forEach(detach_dev);
    			div31_nodes.forEach(detach_dev);
    			t62 = claim_space(div33_nodes);
    			div32 = claim_element(div33_nodes, "DIV", { class: true });
    			var div32_nodes = children(div32);
    			label8 = claim_element(div32_nodes, "LABEL", {});
    			var label8_nodes = children(label8);
    			input9 = claim_element(label8_nodes, "INPUT", { style: true, type: true });
    			t63 = claim_text(label8_nodes, " \r\n                Primária");
    			label8_nodes.forEach(detach_dev);
    			t64 = claim_space(div32_nodes);
    			label9 = claim_element(div32_nodes, "LABEL", {});
    			var label9_nodes = children(label9);
    			input10 = claim_element(label9_nodes, "INPUT", { style: true, type: true });
    			t65 = claim_text(label9_nodes, " \r\n                Secundária");
    			label9_nodes.forEach(detach_dev);
    			t66 = claim_space(div32_nodes);
    			label10 = claim_element(div32_nodes, "LABEL", {});
    			var label10_nodes = children(label10);
    			input11 = claim_element(label10_nodes, "INPUT", { style: true, type: true });
    			t67 = claim_text(label10_nodes, " \r\n                Alerta");
    			label10_nodes.forEach(detach_dev);
    			t68 = claim_space(div32_nodes);
    			label11 = claim_element(div32_nodes, "LABEL", {});
    			var label11_nodes = children(label11);
    			input12 = claim_element(label11_nodes, "INPUT", { style: true, type: true });
    			t69 = claim_text(label11_nodes, " \r\n                Cabeçalho");
    			label11_nodes.forEach(detach_dev);
    			div32_nodes.forEach(detach_dev);
    			div33_nodes.forEach(detach_dev);
    			div34_nodes.forEach(detach_dev);
    			t70 = claim_space(div38_nodes);
    			div37 = claim_element(div38_nodes, "DIV", { class: true });
    			var div37_nodes = children(div37);
    			div36 = claim_element(div37_nodes, "DIV", { class: true });
    			var div36_nodes = children(div36);
    			div35 = claim_element(div36_nodes, "DIV", { class: true });
    			var div35_nodes = children(div35);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div35_nodes);
    			}

    			if (each_1_else) {
    				each_1_else.l(div35_nodes);
    			}

    			div35_nodes.forEach(detach_dev);
    			div36_nodes.forEach(detach_dev);
    			div37_nodes.forEach(detach_dev);
    			div38_nodes.forEach(detach_dev);
    			div39_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			t71 = claim_space(div40_nodes);
    			claim_component(footer.$$.fragment, div40_nodes);
    			div40_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*user*/ ctx[1].dp)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*user*/ ctx[1].instagram);
    			attr_dev(img, "class", "img-fluid rounded-circle mb-2");
    			attr_dev(img, "width", "128");
    			attr_dev(img, "height", "128");
    			add_location(img, file$9, 86, 14, 2663);
    			attr_dev(h4, "class", "card-title mb-0");
    			add_location(h4, file$9, 93, 14, 2884);
    			attr_dev(input0, "type", "text");
    			input0.value = input0_value_value = `https://vitrinedacasa.com.br/${/*user*/ ctx[1].instagram}`;
    			attr_dev(input0, "id", "myInput");
    			set_style(input0, "border", "none");
    			set_style(input0, "width", "100%");
    			set_style(input0, "text-align", "center");
    			set_style(input0, "margin", "5px");
    			set_style(input0, "pointer-events", "none");
    			add_location(input0, file$9, 95, 14, 2951);
    			attr_dev(span0, "class", "tooltiptext svelte-10c3svd");
    			attr_dev(span0, "id", "myTooltip");
    			add_location(span0, file$9, 108, 18, 3476);
    			attr_dev(button, "class", "btn btn-sm btn-success svelte-10c3svd");
    			add_location(button, file$9, 102, 16, 3261);
    			attr_dev(div0, "class", "tooltip svelte-10c3svd");
    			add_location(div0, file$9, 101, 14, 3222);
    			attr_dev(div1, "class", "text-muted mb-2");
    			add_location(div1, file$9, 114, 14, 3668);
    			attr_dev(a0, "class", "btn btn-primary btn-sm svelte-10c3svd");
    			attr_dev(a0, "replace", "");
    			attr_dev(a0, "href", "/addlink");
    			add_location(a0, file$9, 119, 16, 3843);
    			attr_dev(a1, "class", "btn btn-primary btn-sm svelte-10c3svd");
    			attr_dev(a1, "replace", "");
    			attr_dev(a1, "href", "/addschedule");
    			add_location(a1, file$9, 125, 16, 4051);
    			attr_dev(span1, "data-feather", "instagram");
    			add_location(span1, file$9, 135, 19, 4439);
    			attr_dev(a2, "class", "btn btn-danger btn-sm svelte-10c3svd");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "href", a2_href_value = "https://www.instagram.com/" + /*user*/ ctx[1].instagram + "/");
    			add_location(a2, file$9, 131, 16, 4254);
    			add_location(div2, file$9, 118, 14, 3820);
    			attr_dev(div3, "class", "card-body text-center");
    			add_location(div3, file$9, 85, 12, 2612);
    			attr_dev(div4, "class", "card mb-3");
    			add_location(div4, file$9, 84, 10, 2575);
    			attr_dev(i0, "class", "align-middle");
    			attr_dev(i0, "data-feather", "more-horizontal");
    			add_location(i0, file$9, 150, 20, 4930);
    			attr_dev(a3, "href", "/dashboard");
    			attr_dev(a3, "data-toggle", "dropdown");
    			attr_dev(a3, "data-display", "static");
    			add_location(a3, file$9, 145, 18, 4759);
    			attr_dev(a4, "class", "dropdown-item");
    			attr_dev(a4, "href", "/dashboard");
    			add_location(a4, file$9, 154, 20, 5102);
    			attr_dev(div5, "class", "dropdown-menu dropdown-menu-right");
    			add_location(div5, file$9, 153, 18, 5033);
    			attr_dev(div6, "class", "dropdown show");
    			add_location(div6, file$9, 144, 16, 4712);
    			attr_dev(div7, "class", "card-actions float-right");
    			add_location(div7, file$9, 143, 14, 4656);
    			attr_dev(h50, "class", "card-title mb-0");
    			add_location(h50, file$9, 158, 14, 5245);
    			attr_dev(div8, "class", "card-header");
    			add_location(div8, file$9, 142, 12, 4615);
    			add_location(strong0, file$9, 163, 34, 5460);
    			attr_dev(p0, "class", "my-1");
    			add_location(p0, file$9, 163, 18, 5444);
    			attr_dev(p1, "class", "text-info");
    			add_location(p1, file$9, 164, 18, 5517);
    			attr_dev(div9, "class", "media-body");
    			add_location(div9, file$9, 162, 16, 5400);
    			attr_dev(div10, "class", "media");
    			add_location(div10, file$9, 161, 14, 5363);
    			attr_dev(hr0, "class", "my-2");
    			add_location(hr0, file$9, 168, 14, 5618);
    			add_location(strong1, file$9, 172, 34, 5752);
    			attr_dev(p2, "class", "my-1");
    			add_location(p2, file$9, 172, 18, 5736);
    			attr_dev(p3, "class", "text-warning");
    			add_location(p3, file$9, 173, 18, 5809);
    			attr_dev(div11, "class", "media-body");
    			add_location(div11, file$9, 171, 16, 5692);
    			attr_dev(div12, "class", "media");
    			add_location(div12, file$9, 170, 14, 5655);
    			attr_dev(hr1, "class", "my-2");
    			add_location(hr1, file$9, 177, 14, 5909);
    			attr_dev(div13, "class", "card-body");
    			add_location(div13, file$9, 160, 12, 5324);
    			attr_dev(div14, "class", "card mb-3");
    			add_location(div14, file$9, 141, 10, 4578);
    			attr_dev(i1, "class", "align-middle");
    			attr_dev(i1, "data-feather", "more-horizontal");
    			add_location(i1, file$9, 196, 20, 6592);
    			attr_dev(a5, "href", "/dashboard");
    			attr_dev(a5, "data-toggle", "dropdown");
    			attr_dev(a5, "data-display", "static");
    			add_location(a5, file$9, 191, 18, 6421);
    			attr_dev(a6, "class", "dropdown-item");
    			attr_dev(a6, "href", "/dashboard");
    			add_location(a6, file$9, 200, 20, 6764);
    			attr_dev(div15, "class", "dropdown-menu dropdown-menu-right");
    			add_location(div15, file$9, 199, 18, 6695);
    			attr_dev(div16, "class", "dropdown show");
    			add_location(div16, file$9, 190, 16, 6374);
    			attr_dev(div17, "class", "card-actions float-right");
    			add_location(div17, file$9, 189, 14, 6318);
    			attr_dev(h51, "class", "card-title mb-0");
    			add_location(h51, file$9, 204, 14, 6908);
    			attr_dev(div18, "class", "card-header");
    			add_location(div18, file$9, 188, 12, 6277);
    			set_style(input1, "padding", "0");
    			attr_dev(input1, "type", "color");
    			add_location(input1, file$9, 208, 16, 7052);
    			add_location(label0, file$9, 207, 14, 7027);
    			set_style(input2, "padding", "0");
    			attr_dev(input2, "type", "color");
    			add_location(input2, file$9, 212, 16, 7225);
    			add_location(label1, file$9, 211, 14, 7200);
    			set_style(input3, "padding", "0");
    			attr_dev(input3, "type", "color");
    			add_location(input3, file$9, 216, 16, 7402);
    			add_location(label2, file$9, 215, 14, 7377);
    			set_style(input4, "padding", "0");
    			attr_dev(input4, "type", "color");
    			add_location(input4, file$9, 220, 16, 7573);
    			add_location(label3, file$9, 219, 14, 7548);
    			attr_dev(div19, "class", "card-body");
    			add_location(div19, file$9, 206, 12, 6988);
    			attr_dev(div20, "class", "card mb-3");
    			add_location(div20, file$9, 187, 10, 6240);
    			attr_dev(div21, "class", "col-12 col-md-5 col-lg-3");
    			add_location(div21, file$9, 83, 8, 2525);
    			attr_dev(i2, "class", "align-middle");
    			attr_dev(i2, "data-feather", "more-horizontal");
    			add_location(i2, file$9, 236, 20, 8171);
    			attr_dev(a7, "href", "/dashboard");
    			attr_dev(a7, "data-toggle", "dropdown");
    			attr_dev(a7, "data-display", "static");
    			add_location(a7, file$9, 231, 18, 8000);
    			attr_dev(a8, "class", "dropdown-item");
    			attr_dev(a8, "href", "/dashboard");
    			add_location(a8, file$9, 240, 20, 8343);
    			attr_dev(div22, "class", "dropdown-menu dropdown-menu-right");
    			add_location(div22, file$9, 239, 18, 8274);
    			attr_dev(div23, "class", "dropdown show");
    			add_location(div23, file$9, 230, 16, 7953);
    			attr_dev(div24, "class", "card-actions float-right");
    			add_location(div24, file$9, 229, 14, 7897);
    			attr_dev(h52, "class", "card-title mb-0");
    			add_location(h52, file$9, 244, 14, 8487);
    			attr_dev(div25, "class", "card-header");
    			add_location(div25, file$9, 228, 12, 7856);
    			set_style(input5, "padding", "0");
    			attr_dev(input5, "type", "color");
    			add_location(input5, file$9, 248, 16, 8628);
    			add_location(label4, file$9, 247, 14, 8603);
    			set_style(input6, "padding", "0");
    			attr_dev(input6, "type", "color");
    			add_location(input6, file$9, 252, 16, 8797);
    			add_location(label5, file$9, 251, 14, 8772);
    			set_style(input7, "padding", "0");
    			attr_dev(input7, "type", "color");
    			add_location(input7, file$9, 256, 16, 8970);
    			add_location(label6, file$9, 255, 14, 8945);
    			set_style(input8, "padding", "0");
    			attr_dev(input8, "type", "color");
    			add_location(input8, file$9, 260, 16, 9137);
    			add_location(label7, file$9, 259, 14, 9112);
    			attr_dev(div26, "class", "card-body");
    			add_location(div26, file$9, 246, 12, 8564);
    			attr_dev(div27, "class", "card mb-3");
    			add_location(div27, file$9, 227, 10, 7819);
    			attr_dev(i3, "class", "align-middle");
    			attr_dev(i3, "data-feather", "more-horizontal");
    			add_location(i3, file$9, 274, 20, 9667);
    			attr_dev(a9, "href", "/dashboard");
    			attr_dev(a9, "data-toggle", "dropdown");
    			attr_dev(a9, "data-display", "static");
    			add_location(a9, file$9, 269, 18, 9496);
    			attr_dev(a10, "class", "dropdown-item");
    			attr_dev(a10, "href", "/dashboard");
    			add_location(a10, file$9, 278, 20, 9839);
    			attr_dev(div28, "class", "dropdown-menu dropdown-menu-right");
    			add_location(div28, file$9, 277, 18, 9770);
    			attr_dev(div29, "class", "dropdown show");
    			add_location(div29, file$9, 268, 16, 9449);
    			attr_dev(div30, "class", "card-actions float-right");
    			add_location(div30, file$9, 267, 14, 9393);
    			attr_dev(h53, "class", "card-title mb-0");
    			add_location(h53, file$9, 282, 14, 9983);
    			attr_dev(div31, "class", "card-header");
    			add_location(div31, file$9, 266, 12, 9352);
    			set_style(input9, "padding", "0");
    			attr_dev(input9, "type", "color");
    			add_location(input9, file$9, 286, 16, 10135);
    			add_location(label8, file$9, 285, 14, 10110);
    			set_style(input10, "padding", "0");
    			attr_dev(input10, "type", "color");
    			add_location(input10, file$9, 290, 16, 10304);
    			add_location(label9, file$9, 289, 14, 10279);
    			set_style(input11, "padding", "0");
    			attr_dev(input11, "type", "color");
    			add_location(input11, file$9, 294, 16, 10477);
    			add_location(label10, file$9, 293, 14, 10452);
    			set_style(input12, "padding", "0");
    			attr_dev(input12, "type", "color");
    			add_location(input12, file$9, 298, 16, 10644);
    			add_location(label11, file$9, 297, 14, 10619);
    			attr_dev(div32, "class", "card-body");
    			add_location(div32, file$9, 284, 12, 10071);
    			attr_dev(div33, "class", "card mb-3");
    			add_location(div33, file$9, 265, 10, 9315);
    			attr_dev(div34, "class", "col-12 col-md-7 col-lg-5");
    			add_location(div34, file$9, 226, 8, 7769);
    			attr_dev(div35, "class", "card-body h-100");
    			add_location(div35, file$9, 307, 12, 10921);
    			attr_dev(div36, "class", "card");
    			add_location(div36, file$9, 306, 10, 10889);
    			attr_dev(div37, "class", "col-12 col-md-12 col-lg-4");
    			add_location(div37, file$9, 305, 8, 10838);
    			attr_dev(div38, "class", "row");
    			add_location(div38, file$9, 81, 6, 2488);
    			attr_dev(div39, "class", "container-fluid p-0");
    			add_location(div39, file$9, 80, 4, 2447);
    			attr_dev(main, "class", "content");
    			add_location(main, file$9, 79, 2, 2419);
    			attr_dev(div40, "class", "main");
    			attr_dev(div40, "style", /*cssVarStyles*/ ctx[3]);
    			add_location(div40, file$9, 76, 0, 2349);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div40, anchor);
    			mount_component(navbar, div40, null);
    			append_hydration_dev(div40, t0);
    			append_hydration_dev(div40, main);
    			append_hydration_dev(main, div39);
    			append_hydration_dev(div39, div38);
    			append_hydration_dev(div38, div21);
    			append_hydration_dev(div21, div4);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, img);
    			append_hydration_dev(div3, t1);
    			append_hydration_dev(div3, h4);
    			append_hydration_dev(h4, t2);
    			append_hydration_dev(div3, t3);
    			append_hydration_dev(div3, input0);
    			append_hydration_dev(div3, t4);
    			append_hydration_dev(div3, div0);
    			append_hydration_dev(div0, button);
    			append_hydration_dev(button, span0);
    			append_hydration_dev(span0, t5);
    			append_hydration_dev(button, t6);
    			append_hydration_dev(div3, t7);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div1, t8);
    			append_hydration_dev(div1, t9);
    			append_hydration_dev(div3, t10);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, a0);
    			append_hydration_dev(a0, t11);
    			append_hydration_dev(div2, t12);
    			append_hydration_dev(div2, a1);
    			append_hydration_dev(a1, t13);
    			append_hydration_dev(div2, t14);
    			append_hydration_dev(div2, a2);
    			append_hydration_dev(a2, span1);
    			append_hydration_dev(a2, t15);
    			append_hydration_dev(div21, t16);
    			append_hydration_dev(div21, div14);
    			append_hydration_dev(div14, div8);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, a3);
    			append_hydration_dev(a3, i0);
    			append_hydration_dev(div6, t17);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, a4);
    			append_hydration_dev(a4, t18);
    			append_hydration_dev(div8, t19);
    			append_hydration_dev(div8, h50);
    			append_hydration_dev(h50, t20);
    			append_hydration_dev(div14, t21);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div10);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, p0);
    			append_hydration_dev(p0, strong0);
    			append_hydration_dev(strong0, t22);
    			append_hydration_dev(div9, t23);
    			append_hydration_dev(div9, p1);
    			append_hydration_dev(p1, t24);
    			append_hydration_dev(div13, t25);
    			append_hydration_dev(div13, hr0);
    			append_hydration_dev(div13, t26);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, p2);
    			append_hydration_dev(p2, strong1);
    			append_hydration_dev(strong1, t27);
    			append_hydration_dev(div11, t28);
    			append_hydration_dev(div11, p3);
    			append_hydration_dev(p3, t29);
    			append_hydration_dev(div13, t30);
    			append_hydration_dev(div13, hr1);
    			append_hydration_dev(div21, t31);
    			append_hydration_dev(div21, div20);
    			append_hydration_dev(div20, div18);
    			append_hydration_dev(div18, div17);
    			append_hydration_dev(div17, div16);
    			append_hydration_dev(div16, a5);
    			append_hydration_dev(a5, i1);
    			append_hydration_dev(div16, t32);
    			append_hydration_dev(div16, div15);
    			append_hydration_dev(div15, a6);
    			append_hydration_dev(a6, t33);
    			append_hydration_dev(div18, t34);
    			append_hydration_dev(div18, h51);
    			append_hydration_dev(h51, t35);
    			append_hydration_dev(div20, t36);
    			append_hydration_dev(div20, div19);
    			append_hydration_dev(div19, label0);
    			append_hydration_dev(label0, input1);
    			set_input_value(input1, /*user*/ ctx[1].style['primary_color']);
    			append_hydration_dev(label0, t37);
    			append_hydration_dev(div19, t38);
    			append_hydration_dev(div19, label1);
    			append_hydration_dev(label1, input2);
    			set_input_value(input2, /*user*/ ctx[1].style['secondary_color']);
    			append_hydration_dev(label1, t39);
    			append_hydration_dev(div19, t40);
    			append_hydration_dev(div19, label2);
    			append_hydration_dev(label2, input3);
    			set_input_value(input3, /*user*/ ctx[1].style['warning_color']);
    			append_hydration_dev(label2, t41);
    			append_hydration_dev(div19, t42);
    			append_hydration_dev(div19, label3);
    			append_hydration_dev(label3, input4);
    			set_input_value(input4, /*user*/ ctx[1].style['header_color']);
    			append_hydration_dev(label3, t43);
    			append_hydration_dev(div38, t44);
    			append_hydration_dev(div38, div34);
    			append_hydration_dev(div34, div27);
    			append_hydration_dev(div27, div25);
    			append_hydration_dev(div25, div24);
    			append_hydration_dev(div24, div23);
    			append_hydration_dev(div23, a7);
    			append_hydration_dev(a7, i2);
    			append_hydration_dev(div23, t45);
    			append_hydration_dev(div23, div22);
    			append_hydration_dev(div22, a8);
    			append_hydration_dev(a8, t46);
    			append_hydration_dev(div25, t47);
    			append_hydration_dev(div25, h52);
    			append_hydration_dev(h52, t48);
    			append_hydration_dev(div27, t49);
    			append_hydration_dev(div27, div26);
    			append_hydration_dev(div26, label4);
    			append_hydration_dev(label4, input5);
    			set_input_value(input5, /*styles*/ ctx[0]['primary_color']);
    			append_hydration_dev(label4, t50);
    			append_hydration_dev(div26, t51);
    			append_hydration_dev(div26, label5);
    			append_hydration_dev(label5, input6);
    			set_input_value(input6, /*styles*/ ctx[0]['secondary_color']);
    			append_hydration_dev(label5, t52);
    			append_hydration_dev(div26, t53);
    			append_hydration_dev(div26, label6);
    			append_hydration_dev(label6, input7);
    			set_input_value(input7, /*styles*/ ctx[0]['warning_color']);
    			append_hydration_dev(label6, t54);
    			append_hydration_dev(div26, t55);
    			append_hydration_dev(div26, label7);
    			append_hydration_dev(label7, input8);
    			set_input_value(input8, /*styles*/ ctx[0]['header_color']);
    			append_hydration_dev(label7, t56);
    			append_hydration_dev(div34, t57);
    			append_hydration_dev(div34, div33);
    			append_hydration_dev(div33, div31);
    			append_hydration_dev(div31, div30);
    			append_hydration_dev(div30, div29);
    			append_hydration_dev(div29, a9);
    			append_hydration_dev(a9, i3);
    			append_hydration_dev(div29, t58);
    			append_hydration_dev(div29, div28);
    			append_hydration_dev(div28, a10);
    			append_hydration_dev(a10, t59);
    			append_hydration_dev(div31, t60);
    			append_hydration_dev(div31, h53);
    			append_hydration_dev(h53, t61);
    			append_hydration_dev(div33, t62);
    			append_hydration_dev(div33, div32);
    			append_hydration_dev(div32, label8);
    			append_hydration_dev(label8, input9);
    			set_input_value(input9, /*styles*/ ctx[0]['primary_color']);
    			append_hydration_dev(label8, t63);
    			append_hydration_dev(div32, t64);
    			append_hydration_dev(div32, label9);
    			append_hydration_dev(label9, input10);
    			set_input_value(input10, /*styles*/ ctx[0]['secondary_color']);
    			append_hydration_dev(label9, t65);
    			append_hydration_dev(div32, t66);
    			append_hydration_dev(div32, label10);
    			append_hydration_dev(label10, input11);
    			set_input_value(input11, /*styles*/ ctx[0]['warning_color']);
    			append_hydration_dev(label10, t67);
    			append_hydration_dev(div32, t68);
    			append_hydration_dev(div32, label11);
    			append_hydration_dev(label11, input12);
    			set_input_value(input12, /*styles*/ ctx[0]['header_color']);
    			append_hydration_dev(label11, t69);
    			append_hydration_dev(div38, t70);
    			append_hydration_dev(div38, div37);
    			append_hydration_dev(div37, div36);
    			append_hydration_dev(div36, div35);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div35, null);
    			}

    			if (each_1_else) {
    				each_1_else.m(div35, null);
    			}

    			append_hydration_dev(div40, t71);
    			mount_component(footer, div40, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(button, "click", myFunction, false, false, false),
    					listen_dev(button, "mouseout", outFunc, false, false, false),
    					listen_dev(button, "blur", outFunc, false, false, false),
    					action_destroyer(link.call(null, a0)),
    					action_destroyer(link.call(null, a1)),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[6]),
    					listen_dev(input2, "input", /*input2_input_handler*/ ctx[7]),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[8]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[9]),
    					listen_dev(input5, "input", /*input5_input_handler*/ ctx[10]),
    					listen_dev(input6, "input", /*input6_input_handler*/ ctx[11]),
    					listen_dev(input7, "input", /*input7_input_handler*/ ctx[12]),
    					listen_dev(input8, "input", /*input8_input_handler*/ ctx[13]),
    					listen_dev(input9, "input", /*input9_input_handler*/ ctx[14]),
    					listen_dev(input10, "input", /*input10_input_handler*/ ctx[15]),
    					listen_dev(input11, "input", /*input11_input_handler*/ ctx[16]),
    					listen_dev(input12, "input", /*input12_input_handler*/ ctx[17])
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const navbar_changes = {};
    			if (dirty & /*user*/ 2) navbar_changes.user = /*user*/ ctx[1];
    			navbar.$set(navbar_changes);

    			if (!current || dirty & /*user*/ 2 && !src_url_equal(img.src, img_src_value = /*user*/ ctx[1].dp)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*user*/ 2 && img_alt_value !== (img_alt_value = /*user*/ ctx[1].instagram)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if ((!current || dirty & /*user*/ 2) && t2_value !== (t2_value = /*user*/ ctx[1].instagram + "")) set_data_dev(t2, t2_value);

    			if (!current || dirty & /*user*/ 2 && input0_value_value !== (input0_value_value = `https://vitrinedacasa.com.br/${/*user*/ ctx[1].instagram}`) && input0.value !== input0_value_value) {
    				prop_dev(input0, "value", input0_value_value);
    			}

    			if ((!current || dirty & /*user*/ 2) && t9_value !== (t9_value = (/*user*/ ctx[1].total_links || 0) + "")) set_data_dev(t9, t9_value);

    			if (!current || dirty & /*user*/ 2 && a2_href_value !== (a2_href_value = "https://www.instagram.com/" + /*user*/ ctx[1].instagram + "/")) {
    				attr_dev(a2, "href", a2_href_value);
    			}

    			if ((!current || dirty & /*user*/ 2) && t24_value !== (t24_value = /*user*/ ctx[1].views + "")) set_data_dev(t24, t24_value);
    			if (!current || dirty & /*clicks*/ 4) set_data_dev(t29, /*clicks*/ ctx[2]);

    			if (dirty & /*user*/ 2) {
    				set_input_value(input1, /*user*/ ctx[1].style['primary_color']);
    			}

    			if (dirty & /*user*/ 2) {
    				set_input_value(input2, /*user*/ ctx[1].style['secondary_color']);
    			}

    			if (dirty & /*user*/ 2) {
    				set_input_value(input3, /*user*/ ctx[1].style['warning_color']);
    			}

    			if (dirty & /*user*/ 2) {
    				set_input_value(input4, /*user*/ ctx[1].style['header_color']);
    			}

    			if (dirty & /*styles*/ 1) {
    				set_input_value(input5, /*styles*/ ctx[0]['primary_color']);
    			}

    			if (dirty & /*styles*/ 1) {
    				set_input_value(input6, /*styles*/ ctx[0]['secondary_color']);
    			}

    			if (dirty & /*styles*/ 1) {
    				set_input_value(input7, /*styles*/ ctx[0]['warning_color']);
    			}

    			if (dirty & /*styles*/ 1) {
    				set_input_value(input8, /*styles*/ ctx[0]['header_color']);
    			}

    			if (dirty & /*styles*/ 1) {
    				set_input_value(input9, /*styles*/ ctx[0]['primary_color']);
    			}

    			if (dirty & /*styles*/ 1) {
    				set_input_value(input10, /*styles*/ ctx[0]['secondary_color']);
    			}

    			if (dirty & /*styles*/ 1) {
    				set_input_value(input11, /*styles*/ ctx[0]['warning_color']);
    			}

    			if (dirty & /*styles*/ 1) {
    				set_input_value(input12, /*styles*/ ctx[0]['header_color']);
    			}

    			if (dirty & /*deleteLink, user, editlink, moment*/ 50) {
    				each_value = /*user*/ ctx[1].links;
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$4(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$4(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div35, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;

    				if (!each_value.length && each_1_else) {
    					each_1_else.p(ctx, dirty);
    				} else if (!each_value.length) {
    					each_1_else = create_else_block_1(ctx);
    					each_1_else.c();
    					each_1_else.m(div35, null);
    				} else if (each_1_else) {
    					each_1_else.d(1);
    					each_1_else = null;
    				}
    			}

    			if (!current || dirty & /*cssVarStyles*/ 8) {
    				attr_dev(div40, "style", /*cssVarStyles*/ ctx[3]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div40);
    			destroy_component(navbar);
    			destroy_each(each_blocks, detaching);
    			if (each_1_else) each_1_else.d();
    			destroy_component(footer);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function myFunction() {
    	var copyText = document.getElementById("myInput");
    	copyText.select();
    	copyText.setSelectionRange(0, 99999);
    	document.execCommand("copy");
    	var tooltip = document.getElementById("myTooltip");
    	tooltip.innerHTML = "Copied: " + copyText.value;
    }

    function outFunc() {
    	var tooltip = document.getElementById("myTooltip");
    	tooltip.innerHTML = "Copy to clipboard";
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let cssVarStyles;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Dashboard', slots, []);
    	let user = {};
    	let clicks = 0;
    	let styles = {};
    	moment.locale('pt');

    	const unsubscribe = userStore.subscribe(async data => {
    		console.log(user);
    		$$invalidate(1, user = data.user);

    		if (user.links) for (var i = 0; i < user.links.length; i++) {
    			$$invalidate(2, clicks = clicks + user.links[i].clicks);
    		}
    	});

    	onMount(() => {
    		getinfo();
    		$$invalidate(0, styles['warning_color'] = user.style.warning_color, styles);
    		$$invalidate(0, styles['secondary_color'] = user.style.secondary_color, styles);
    		$$invalidate(0, styles['primary_color'] = user.style.primary_color, styles);
    		$$invalidate(0, styles['header_color'] = user.style.header_color, styles);
    	});

    	onDestroy(unsubscribe);
    	let status = -1;
    	let mssg = "";

    	const deleteLink = async a => {
    		if (!confirm("Are you sure you want to delete this ?")) {
    			return;
    		}

    		let res = await deletelink(a);
    		status = res.status;
    		mssg = res.mssg;
    	};

    	const editlink = async a => {
    		await userStore.update(currUser => {
    			console.log("updated");

    			return {
    				token: currUser.token,
    				user: currUser.user,
    				link: a
    			};
    		});

    		document.location.href = "/editlink";
    	};

    	const editschedule = async a => {
    		await userStore.update(currUser => {
    			console.log("updated");

    			return {
    				token: currUser.token,
    				user: currUser.user,
    				schedule: a
    			};
    		});

    		document.location.href = "/editschedule";
    	};

    	const writable_props = [];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$6.warn(`<Dashboard> was created with unknown prop '${key}'`);
    	});

    	function input1_input_handler() {
    		user.style['primary_color'] = this.value;
    		$$invalidate(1, user);
    	}

    	function input2_input_handler() {
    		user.style['secondary_color'] = this.value;
    		$$invalidate(1, user);
    	}

    	function input3_input_handler() {
    		user.style['warning_color'] = this.value;
    		$$invalidate(1, user);
    	}

    	function input4_input_handler() {
    		user.style['header_color'] = this.value;
    		$$invalidate(1, user);
    	}

    	function input5_input_handler() {
    		styles['primary_color'] = this.value;
    		$$invalidate(0, styles);
    	}

    	function input6_input_handler() {
    		styles['secondary_color'] = this.value;
    		$$invalidate(0, styles);
    	}

    	function input7_input_handler() {
    		styles['warning_color'] = this.value;
    		$$invalidate(0, styles);
    	}

    	function input8_input_handler() {
    		styles['header_color'] = this.value;
    		$$invalidate(0, styles);
    	}

    	function input9_input_handler() {
    		styles['primary_color'] = this.value;
    		$$invalidate(0, styles);
    	}

    	function input10_input_handler() {
    		styles['secondary_color'] = this.value;
    		$$invalidate(0, styles);
    	}

    	function input11_input_handler() {
    		styles['warning_color'] = this.value;
    		$$invalidate(0, styles);
    	}

    	function input12_input_handler() {
    		styles['header_color'] = this.value;
    		$$invalidate(0, styles);
    	}

    	const click_handler = link => {
    		editlink(link);
    	};

    	const click_handler_1 = link => {
    		deleteLink(link._id);
    	};

    	const click_handler_2 = link => {
    		deleteLink(link._id);
    	};

    	$$self.$capture_state = () => ({
    		link,
    		moment,
    		userStore,
    		NavBar: Navbar,
    		Footer,
    		deletelink,
    		getinfo,
    		onDestroy,
    		onMount,
    		user,
    		clicks,
    		styles,
    		unsubscribe,
    		status,
    		mssg,
    		deleteLink,
    		editlink,
    		editschedule,
    		myFunction,
    		outFunc,
    		cssVarStyles
    	});

    	$$self.$inject_state = $$props => {
    		if ('user' in $$props) $$invalidate(1, user = $$props.user);
    		if ('clicks' in $$props) $$invalidate(2, clicks = $$props.clicks);
    		if ('styles' in $$props) $$invalidate(0, styles = $$props.styles);
    		if ('status' in $$props) status = $$props.status;
    		if ('mssg' in $$props) mssg = $$props.mssg;
    		if ('cssVarStyles' in $$props) $$invalidate(3, cssVarStyles = $$props.cssVarStyles);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*styles*/ 1) {
    			$$invalidate(3, cssVarStyles = Object.entries(styles).map(([key, value]) => `--${key}:${value}`).join(';'));
    		}
    	};

    	return [
    		styles,
    		user,
    		clicks,
    		cssVarStyles,
    		deleteLink,
    		editlink,
    		input1_input_handler,
    		input2_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		input5_input_handler,
    		input6_input_handler,
    		input7_input_handler,
    		input8_input_handler,
    		input9_input_handler,
    		input10_input_handler,
    		input11_input_handler,
    		input12_input_handler,
    		click_handler,
    		click_handler_1,
    		click_handler_2
    	];
    }

    class Dashboard extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Dashboard",
    			options,
    			id: create_fragment$9.name
    		});
    	}
    }

    /* src\pages\AddLink.svelte generated by Svelte v3.47.0 */

    const { console: console_1$5 } = globals;
    const file$8 = "src\\pages\\AddLink.svelte";

    function get_each_context$3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    // (71:20) {:else}
    function create_else_block$4(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			img = claim_element(nodes, "IMG", {
    				src: true,
    				alt: true,
    				class: true,
    				width: true,
    				height: true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*image*/ ctx[3])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Not found user");
    			attr_dev(img, "class", "img-fluid");
    			attr_dev(img, "width", "132");
    			attr_dev(img, "height", "132");
    			add_location(img, file$8, 71, 22, 2238);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*image*/ 8 && !src_url_equal(img.src, img_src_value = /*image*/ ctx[3])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$4.name,
    		type: "else",
    		source: "(71:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (67:20) {#if loading}
    function create_if_block$5(ctx) {
    	let div;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t = text("Carregando...");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, role: true });
    			var div_nodes = children(div);
    			span = claim_element(div_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "Carregando...");
    			span_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "sr-only");
    			add_location(span, file$8, 68, 24, 2113);
    			attr_dev(div, "class", "spinner-border text-primary");
    			attr_dev(div, "role", "status");
    			add_location(div, file$8, 67, 22, 2032);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, span);
    			append_hydration_dev(span, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(67:20) {#if loading}",
    		ctx
    	});

    	return block;
    }

    // (98:23) {#each types as type(type)}
    function create_each_block$3(key_1, ctx) {
    	let option;
    	let t_value = /*type*/ ctx[12] + "";
    	let t;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			option = claim_element(nodes, "OPTION", {});
    			var option_nodes = children(option);
    			t = claim_text(option_nodes, t_value);
    			option_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			option.__value = /*type*/ ctx[12];
    			option.value = option.__value;
    			add_location(option, file$8, 98, 26, 3333);
    			this.first = option;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, option, anchor);
    			append_hydration_dev(option, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$3.name,
    		type: "each",
    		source: "(98:23) {#each types as type(type)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$8(ctx) {
    	let div15;
    	let main;
    	let div14;
    	let div13;
    	let div12;
    	let div11;
    	let div0;
    	let h1;
    	let t0;
    	let t1;
    	let p;
    	let t2;
    	let t3;
    	let div10;
    	let div9;
    	let div8;
    	let div1;
    	let t4;
    	let form;
    	let div2;
    	let label0;
    	let t5;
    	let t6;
    	let input0;
    	let t7;
    	let div3;
    	let label1;
    	let t8;
    	let t9;
    	let select;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t10;
    	let div4;
    	let label2;
    	let t11;
    	let t12;
    	let input1;
    	let t13;
    	let div5;
    	let label3;
    	let t14;
    	let t15;
    	let textarea;
    	let t16;
    	let div6;
    	let label4;
    	let t17;
    	let t18;
    	let input2;
    	let t19;
    	let div7;
    	let button;
    	let t20;
    	let t21;
    	let alert;
    	let current;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[0]) return create_if_block$5;
    		return create_else_block$4;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value = /*types*/ ctx[5];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*type*/ ctx[12];
    	validate_each_keys(ctx, each_value, get_each_context$3, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$3(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$3(key, child_ctx));
    	}

    	alert = new Alert({
    			props: {
    				mssg: /*mssg*/ ctx[2],
    				status: /*status*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div15 = element("div");
    			main = element("main");
    			div14 = element("div");
    			div13 = element("div");
    			div12 = element("div");
    			div11 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("Criar página de produto ou serviço");
    			t1 = space();
    			p = element("p");
    			t2 = text("Digite os detalhes");
    			t3 = space();
    			div10 = element("div");
    			div9 = element("div");
    			div8 = element("div");
    			div1 = element("div");
    			if_block.c();
    			t4 = space();
    			form = element("form");
    			div2 = element("div");
    			label0 = element("label");
    			t5 = text("Titulo");
    			t6 = space();
    			input0 = element("input");
    			t7 = space();
    			div3 = element("div");
    			label1 = element("label");
    			t8 = text("Tipo");
    			t9 = space();
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t10 = space();
    			div4 = element("div");
    			label2 = element("label");
    			t11 = text("Url");
    			t12 = space();
    			input1 = element("input");
    			t13 = space();
    			div5 = element("div");
    			label3 = element("label");
    			t14 = text("Descrição");
    			t15 = space();
    			textarea = element("textarea");
    			t16 = space();
    			div6 = element("div");
    			label4 = element("label");
    			t17 = text("Carregue uma imagem (se desejar)");
    			t18 = space();
    			input2 = element("input");
    			t19 = space();
    			div7 = element("div");
    			button = element("button");
    			t20 = text("Criar Página");
    			t21 = space();
    			create_component(alert.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div15 = claim_element(nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			main = claim_element(div15_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div14 = claim_element(main_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div0 = claim_element(div11_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Criar página de produto ou serviço");
    			h1_nodes.forEach(detach_dev);
    			t1 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t2 = claim_text(p_nodes, "Digite os detalhes");
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t3 = claim_space(div11_nodes);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div1 = claim_element(div8_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t4 = claim_space(div8_nodes);
    			form = claim_element(div8_nodes, "FORM", {});
    			var form_nodes = children(form);
    			div2 = claim_element(form_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			label0 = claim_element(div2_nodes, "LABEL", { for: true });
    			var label0_nodes = children(label0);
    			t5 = claim_text(label0_nodes, "Titulo");
    			label0_nodes.forEach(detach_dev);
    			t6 = claim_space(div2_nodes);

    			input0 = claim_element(div2_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div2_nodes.forEach(detach_dev);
    			t7 = claim_space(form_nodes);
    			div3 = claim_element(form_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			label1 = claim_element(div3_nodes, "LABEL", { for: true });
    			var label1_nodes = children(label1);
    			t8 = claim_text(label1_nodes, "Tipo");
    			label1_nodes.forEach(detach_dev);
    			t9 = claim_space(div3_nodes);
    			select = claim_element(div3_nodes, "SELECT", { class: true });
    			var select_nodes = children(select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(select_nodes);
    			}

    			select_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t10 = claim_space(form_nodes);
    			div4 = claim_element(form_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			label2 = claim_element(div4_nodes, "LABEL", { for: true });
    			var label2_nodes = children(label2);
    			t11 = claim_text(label2_nodes, "Url");
    			label2_nodes.forEach(detach_dev);
    			t12 = claim_space(div4_nodes);

    			input1 = claim_element(div4_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div4_nodes.forEach(detach_dev);
    			t13 = claim_space(form_nodes);
    			div5 = claim_element(form_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			label3 = claim_element(div5_nodes, "LABEL", { for: true });
    			var label3_nodes = children(label3);
    			t14 = claim_text(label3_nodes, "Descrição");
    			label3_nodes.forEach(detach_dev);
    			t15 = claim_space(div5_nodes);
    			textarea = claim_element(div5_nodes, "TEXTAREA", { class: true, placeholder: true });
    			children(textarea).forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t16 = claim_space(form_nodes);
    			div6 = claim_element(form_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			label4 = claim_element(div6_nodes, "LABEL", { for: true });
    			var label4_nodes = children(label4);
    			t17 = claim_text(label4_nodes, "Carregue uma imagem (se desejar)");
    			label4_nodes.forEach(detach_dev);
    			t18 = claim_space(div6_nodes);
    			input2 = claim_element(div6_nodes, "INPUT", { id: true, name: true, type: true });
    			div6_nodes.forEach(detach_dev);
    			t19 = claim_space(form_nodes);
    			div7 = claim_element(form_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			button = claim_element(div7_nodes, "BUTTON", { type: true, class: true });
    			var button_nodes = children(button);
    			t20 = claim_text(button_nodes, "Criar Página");
    			button_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			t21 = claim_space(nodes);
    			claim_component(alert.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "h2");
    			add_location(h1, file$8, 58, 14, 1689);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$8, 59, 14, 1759);
    			attr_dev(div0, "class", "text-center mt-4");
    			add_location(div0, file$8, 57, 12, 1643);
    			attr_dev(div1, "class", "text-center");
    			add_location(div1, file$8, 65, 18, 1948);
    			attr_dev(label0, "for", "");
    			add_location(label0, file$8, 82, 22, 2639);
    			attr_dev(input0, "class", "form-control form-control-lg");
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "placeholder", "Produto ou Serviço");
    			add_location(input0, file$8, 83, 22, 2691);
    			attr_dev(div2, "class", "form-group");
    			add_location(div2, file$8, 81, 20, 2591);
    			attr_dev(label1, "for", "");
    			add_location(label1, file$8, 92, 22, 3061);
    			attr_dev(select, "class", "form-control form-control-lg");
    			if (/*link*/ ctx[4].type === void 0) add_render_callback(() => /*select_change_handler*/ ctx[9].call(select));
    			add_location(select, file$8, 93, 22, 3111);
    			attr_dev(div3, "class", "form-group");
    			add_location(div3, file$8, 91, 20, 3013);
    			attr_dev(label2, "for", "");
    			add_location(label2, file$8, 103, 22, 3519);
    			attr_dev(input1, "class", "form-control form-control-lg");
    			attr_dev(input1, "type", "text");
    			input1.required = true;
    			attr_dev(input1, "placeholder", "https://vitrinedacasa.com.br/usuario/urldoproduto");
    			add_location(input1, file$8, 104, 22, 3568);
    			attr_dev(div4, "class", "form-group");
    			add_location(div4, file$8, 102, 20, 3471);
    			attr_dev(label3, "for", "");
    			add_location(label3, file$8, 113, 22, 3967);
    			attr_dev(textarea, "class", "form-control form-control-lg");
    			attr_dev(textarea, "placeholder", "Descreva o que você está oferecendo, seja objetivo com o seu cliente.");
    			add_location(textarea, file$8, 114, 22, 4022);
    			attr_dev(div5, "class", "form-group");
    			add_location(div5, file$8, 112, 20, 3919);
    			attr_dev(label4, "for", "");
    			add_location(label4, file$8, 121, 22, 4381);
    			attr_dev(input2, "id", "file");
    			attr_dev(input2, "name", "file");
    			attr_dev(input2, "type", "file");
    			add_location(input2, file$8, 122, 22, 4459);
    			attr_dev(div6, "class", "form-group");
    			add_location(div6, file$8, 120, 20, 4333);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "btn btn-lg btn-primary");
    			add_location(button, file$8, 130, 22, 4746);
    			attr_dev(div7, "class", "text-center mt-3");
    			add_location(div7, file$8, 129, 20, 4692);
    			add_location(form, file$8, 80, 18, 2542);
    			attr_dev(div8, "class", "m-sm-4");
    			add_location(div8, file$8, 64, 16, 1908);
    			attr_dev(div9, "class", "card-body");
    			add_location(div9, file$8, 63, 14, 1867);
    			attr_dev(div10, "class", "card");
    			add_location(div10, file$8, 62, 12, 1833);
    			attr_dev(div11, "class", "d-table-cell align-middle");
    			add_location(div11, file$8, 56, 10, 1590);
    			attr_dev(div12, "class", "col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100");
    			add_location(div12, file$8, 55, 8, 1515);
    			attr_dev(div13, "class", "row h-100");
    			add_location(div13, file$8, 54, 6, 1482);
    			attr_dev(div14, "class", "container d-flex flex-column");
    			add_location(div14, file$8, 53, 4, 1432);
    			attr_dev(main, "class", "content d-flex p-0");
    			add_location(main, file$8, 52, 2, 1393);
    			attr_dev(div15, "class", "main d-flex justify-content-center w-100");
    			add_location(div15, file$8, 51, 0, 1335);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div15, anchor);
    			append_hydration_dev(div15, main);
    			append_hydration_dev(main, div14);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t2);
    			append_hydration_dev(div11, t3);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div1);
    			if_block.m(div1, null);
    			append_hydration_dev(div8, t4);
    			append_hydration_dev(div8, form);
    			append_hydration_dev(form, div2);
    			append_hydration_dev(div2, label0);
    			append_hydration_dev(label0, t5);
    			append_hydration_dev(div2, t6);
    			append_hydration_dev(div2, input0);
    			set_input_value(input0, /*link*/ ctx[4].title);
    			append_hydration_dev(form, t7);
    			append_hydration_dev(form, div3);
    			append_hydration_dev(div3, label1);
    			append_hydration_dev(label1, t8);
    			append_hydration_dev(div3, t9);
    			append_hydration_dev(div3, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*link*/ ctx[4].type);
    			append_hydration_dev(form, t10);
    			append_hydration_dev(form, div4);
    			append_hydration_dev(div4, label2);
    			append_hydration_dev(label2, t11);
    			append_hydration_dev(div4, t12);
    			append_hydration_dev(div4, input1);
    			set_input_value(input1, /*link*/ ctx[4].url);
    			append_hydration_dev(form, t13);
    			append_hydration_dev(form, div5);
    			append_hydration_dev(div5, label3);
    			append_hydration_dev(label3, t14);
    			append_hydration_dev(div5, t15);
    			append_hydration_dev(div5, textarea);
    			set_input_value(textarea, /*link*/ ctx[4].description);
    			append_hydration_dev(form, t16);
    			append_hydration_dev(form, div6);
    			append_hydration_dev(div6, label4);
    			append_hydration_dev(label4, t17);
    			append_hydration_dev(div6, t18);
    			append_hydration_dev(div6, input2);
    			append_hydration_dev(form, t19);
    			append_hydration_dev(form, div7);
    			append_hydration_dev(div7, button);
    			append_hydration_dev(button, t20);
    			insert_hydration_dev(target, t21, anchor);
    			mount_component(alert, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[8]),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[10]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[11]),
    					listen_dev(input2, "change", /*drop*/ ctx[6], false, false, false),
    					listen_dev(form, "submit", /*dispatch*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}

    			if (dirty & /*link, types*/ 48 && input0.value !== /*link*/ ctx[4].title) {
    				set_input_value(input0, /*link*/ ctx[4].title);
    			}

    			if (dirty & /*types*/ 32) {
    				each_value = /*types*/ ctx[5];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$3, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, select, destroy_block, create_each_block$3, null, get_each_context$3);
    			}

    			if (dirty & /*link, types*/ 48) {
    				select_option(select, /*link*/ ctx[4].type);
    			}

    			if (dirty & /*link, types*/ 48 && input1.value !== /*link*/ ctx[4].url) {
    				set_input_value(input1, /*link*/ ctx[4].url);
    			}

    			if (dirty & /*link, types*/ 48) {
    				set_input_value(textarea, /*link*/ ctx[4].description);
    			}

    			const alert_changes = {};
    			if (dirty & /*mssg*/ 4) alert_changes.mssg = /*mssg*/ ctx[2];
    			if (dirty & /*status*/ 2) alert_changes.status = /*status*/ ctx[1];
    			alert.$set(alert_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(alert.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(alert.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div15);
    			if_block.d();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching) detach_dev(t21);
    			destroy_component(alert, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('AddLink', slots, []);
    	let loading = false;
    	let status = -1;
    	let mssg = "";
    	let image = "https://www.lifewire.com/thmb/P856-0hi4lmA2xinYWyaEpRIckw=/1920x1326/filters:no_upscale():max_bytes(150000):strip_icc()/cloud-upload-a30f385a928e44e199a62210d578375a.jpg";

    	let link = {
    		url: "",
    		title: "",
    		image: "",
    		description: "",
    		clicks: 0,
    		likes: 0
    	};

    	let types = ['Link', 'Whatsapp', 'Agendamento', 'Orçamento', 'Pedido'];

    	const drop = async e => {
    		$$invalidate(0, loading = true);
    		const files = e.target.files;
    		const data = new FormData();
    		data.append("file", files[0]);
    		data.append("upload_preset", "vitrinedacasa");
    		const res = await fetch("https://api.cloudinary.com/v1_1/sankarkvs/image/upload", { method: "POST", body: data });
    		$$invalidate(0, loading = false);
    		const file = await res.json();
    		$$invalidate(4, link.image = file.secure_url, link);
    		$$invalidate(3, image = file.secure_url);
    	};

    	const dispatch = async e => {
    		e.preventDefault();
    		let res = await addlink(link);
    		$$invalidate(1, status = res.status);
    		$$invalidate(2, mssg = res.mssg);
    		console.log(res);
    		document.location.href = "/dashboard";
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$5.warn(`<AddLink> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		link.title = this.value;
    		$$invalidate(4, link);
    		$$invalidate(5, types);
    	}

    	function select_change_handler() {
    		link.type = select_value(this);
    		$$invalidate(4, link);
    		$$invalidate(5, types);
    	}

    	function input1_input_handler() {
    		link.url = this.value;
    		$$invalidate(4, link);
    		$$invalidate(5, types);
    	}

    	function textarea_input_handler() {
    		link.description = this.value;
    		$$invalidate(4, link);
    		$$invalidate(5, types);
    	}

    	$$self.$capture_state = () => ({
    		Alert,
    		addlink,
    		loading,
    		status,
    		mssg,
    		image,
    		link,
    		types,
    		drop,
    		dispatch
    	});

    	$$self.$inject_state = $$props => {
    		if ('loading' in $$props) $$invalidate(0, loading = $$props.loading);
    		if ('status' in $$props) $$invalidate(1, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(2, mssg = $$props.mssg);
    		if ('image' in $$props) $$invalidate(3, image = $$props.image);
    		if ('link' in $$props) $$invalidate(4, link = $$props.link);
    		if ('types' in $$props) $$invalidate(5, types = $$props.types);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		loading,
    		status,
    		mssg,
    		image,
    		link,
    		types,
    		drop,
    		dispatch,
    		input0_input_handler,
    		select_change_handler,
    		input1_input_handler,
    		textarea_input_handler
    	];
    }

    class AddLink extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AddLink",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    /* src\pages\EditLink.svelte generated by Svelte v3.47.0 */

    const { console: console_1$4 } = globals;
    const file$7 = "src\\pages\\EditLink.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    // (74:20) {:else}
    function create_else_block$3(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			img = claim_element(nodes, "IMG", {
    				src: true,
    				alt: true,
    				class: true,
    				width: true,
    				height: true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*image*/ ctx[3])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Not found user");
    			attr_dev(img, "class", "img-fluid");
    			attr_dev(img, "width", "132");
    			attr_dev(img, "height", "132");
    			add_location(img, file$7, 74, 22, 2503);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*image*/ 8 && !src_url_equal(img.src, img_src_value = /*image*/ ctx[3])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(74:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (70:20) {#if loading}
    function create_if_block$4(ctx) {
    	let div;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t = text("Carregando...");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, role: true });
    			var div_nodes = children(div);
    			span = claim_element(div_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "Carregando...");
    			span_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "sr-only");
    			add_location(span, file$7, 71, 24, 2378);
    			attr_dev(div, "class", "spinner-border text-primary");
    			attr_dev(div, "role", "status");
    			add_location(div, file$7, 70, 22, 2297);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, span);
    			append_hydration_dev(span, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(70:20) {#if loading}",
    		ctx
    	});

    	return block;
    }

    // (137:23) {#each types as type(type)}
    function create_each_block$2(key_1, ctx) {
    	let option;
    	let t_value = /*type*/ ctx[15] + "";
    	let t;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			option = claim_element(nodes, "OPTION", {});
    			var option_nodes = children(option);
    			t = claim_text(option_nodes, t_value);
    			option_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			option.__value = /*type*/ ctx[15];
    			option.value = option.__value;
    			add_location(option, file$7, 137, 26, 5175);
    			this.first = option;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, option, anchor);
    			append_hydration_dev(option, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(137:23) {#each types as type(type)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let navbar;
    	let t0;
    	let div16;
    	let main;
    	let div15;
    	let div14;
    	let div13;
    	let div12;
    	let div0;
    	let h1;
    	let t1;
    	let t2;
    	let p;
    	let t3;
    	let t4;
    	let div11;
    	let div10;
    	let div9;
    	let div1;
    	let t5;
    	let form;
    	let div2;
    	let label0;
    	let t6;
    	let t7;
    	let input0;
    	let t8;
    	let div3;
    	let label1;
    	let t9;
    	let t10;
    	let input1;
    	let t11;
    	let div4;
    	let label2;
    	let t12;
    	let t13;
    	let input2;
    	let t14;
    	let div5;
    	let label3;
    	let t15;
    	let t16;
    	let input3;
    	let t17;
    	let div6;
    	let label4;
    	let t18;
    	let t19;
    	let input4;
    	let t20;
    	let div7;
    	let label5;
    	let t21;
    	let t22;
    	let select;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t23;
    	let div8;
    	let button;
    	let t24;
    	let t25;
    	let alert;
    	let t26;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;

    	navbar = new Navbar({
    			props: { user: /*user*/ ctx[5] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[0]) return create_if_block$4;
    		return create_else_block$3;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value = /*types*/ ctx[6];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*type*/ ctx[15];
    	validate_each_keys(ctx, each_value, get_each_context$2, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$2(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$2(key, child_ctx));
    	}

    	alert = new Alert({
    			props: {
    				mssg: /*mssg*/ ctx[2],
    				status: /*status*/ ctx[1]
    			},
    			$$inline: true
    		});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    			t0 = space();
    			div16 = element("div");
    			main = element("main");
    			div15 = element("div");
    			div14 = element("div");
    			div13 = element("div");
    			div12 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t1 = text("Multiplique as possibilidades");
    			t2 = space();
    			p = element("p");
    			t3 = text("Uma página personalizada para seu Produto ou Serviço");
    			t4 = space();
    			div11 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			div1 = element("div");
    			if_block.c();
    			t5 = space();
    			form = element("form");
    			div2 = element("div");
    			label0 = element("label");
    			t6 = text("Url");
    			t7 = space();
    			input0 = element("input");
    			t8 = space();
    			div3 = element("div");
    			label1 = element("label");
    			t9 = text("Título");
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			div4 = element("div");
    			label2 = element("label");
    			t12 = text("Carregue uma imagem (se desejar)");
    			t13 = space();
    			input2 = element("input");
    			t14 = space();
    			div5 = element("div");
    			label3 = element("label");
    			t15 = text("Descrição");
    			t16 = space();
    			input3 = element("input");
    			t17 = space();
    			div6 = element("div");
    			label4 = element("label");
    			t18 = text("Preço");
    			t19 = space();
    			input4 = element("input");
    			t20 = space();
    			div7 = element("div");
    			label5 = element("label");
    			t21 = text("Tipo");
    			t22 = space();
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t23 = space();
    			div8 = element("div");
    			button = element("button");
    			t24 = text("Salvar");
    			t25 = space();
    			create_component(alert.$$.fragment);
    			t26 = space();
    			create_component(footer.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			claim_component(navbar.$$.fragment, nodes);
    			t0 = claim_space(nodes);
    			div16 = claim_element(nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			main = claim_element(div16_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div15 = claim_element(main_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			div14 = claim_element(div15_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div0 = claim_element(div12_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t1 = claim_text(h1_nodes, "Multiplique as possibilidades");
    			h1_nodes.forEach(detach_dev);
    			t2 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, "Uma página personalizada para seu Produto ou Serviço");
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t4 = claim_space(div12_nodes);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div1 = claim_element(div9_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div9_nodes);
    			form = claim_element(div9_nodes, "FORM", {});
    			var form_nodes = children(form);
    			div2 = claim_element(form_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			label0 = claim_element(div2_nodes, "LABEL", { for: true });
    			var label0_nodes = children(label0);
    			t6 = claim_text(label0_nodes, "Url");
    			label0_nodes.forEach(detach_dev);
    			t7 = claim_space(div2_nodes);

    			input0 = claim_element(div2_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div2_nodes.forEach(detach_dev);
    			t8 = claim_space(form_nodes);
    			div3 = claim_element(form_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			label1 = claim_element(div3_nodes, "LABEL", { for: true });
    			var label1_nodes = children(label1);
    			t9 = claim_text(label1_nodes, "Título");
    			label1_nodes.forEach(detach_dev);
    			t10 = claim_space(div3_nodes);

    			input1 = claim_element(div3_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div3_nodes.forEach(detach_dev);
    			t11 = claim_space(form_nodes);
    			div4 = claim_element(form_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			label2 = claim_element(div4_nodes, "LABEL", { for: true });
    			var label2_nodes = children(label2);
    			t12 = claim_text(label2_nodes, "Carregue uma imagem (se desejar)");
    			label2_nodes.forEach(detach_dev);
    			t13 = claim_space(div4_nodes);
    			input2 = claim_element(div4_nodes, "INPUT", { id: true, name: true, type: true });
    			div4_nodes.forEach(detach_dev);
    			t14 = claim_space(form_nodes);
    			div5 = claim_element(form_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			label3 = claim_element(div5_nodes, "LABEL", { for: true });
    			var label3_nodes = children(label3);
    			t15 = claim_text(label3_nodes, "Descrição");
    			label3_nodes.forEach(detach_dev);
    			t16 = claim_space(div5_nodes);

    			input3 = claim_element(div5_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div5_nodes.forEach(detach_dev);
    			t17 = claim_space(form_nodes);
    			div6 = claim_element(form_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			label4 = claim_element(div6_nodes, "LABEL", { for: true });
    			var label4_nodes = children(label4);
    			t18 = claim_text(label4_nodes, "Preço");
    			label4_nodes.forEach(detach_dev);
    			t19 = claim_space(div6_nodes);
    			input4 = claim_element(div6_nodes, "INPUT", { class: true, type: true });
    			div6_nodes.forEach(detach_dev);
    			t20 = claim_space(form_nodes);
    			div7 = claim_element(form_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			label5 = claim_element(div7_nodes, "LABEL", { for: true });
    			var label5_nodes = children(label5);
    			t21 = claim_text(label5_nodes, "Tipo");
    			label5_nodes.forEach(detach_dev);
    			t22 = claim_space(div7_nodes);
    			select = claim_element(div7_nodes, "SELECT", { class: true });
    			var select_nodes = children(select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(select_nodes);
    			}

    			select_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			t23 = claim_space(form_nodes);
    			div8 = claim_element(form_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			button = claim_element(div8_nodes, "BUTTON", { type: true, class: true });
    			var button_nodes = children(button);
    			t24 = claim_text(button_nodes, "Salvar");
    			button_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			div16_nodes.forEach(detach_dev);
    			t25 = claim_space(nodes);
    			claim_component(alert.$$.fragment, nodes);
    			t26 = claim_space(nodes);
    			claim_component(footer.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "h2");
    			add_location(h1, file$7, 61, 14, 1925);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$7, 62, 14, 1990);
    			attr_dev(div0, "class", "text-center mt-4");
    			add_location(div0, file$7, 60, 12, 1879);
    			attr_dev(div1, "class", "text-center");
    			add_location(div1, file$7, 68, 18, 2213);
    			attr_dev(label0, "for", "");
    			add_location(label0, file$7, 85, 22, 2904);
    			attr_dev(input0, "class", "form-control form-control-lg");
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "placeholder", "https://itesmesankar.herokuapp.com/");
    			add_location(input0, file$7, 86, 22, 2953);
    			attr_dev(div2, "class", "form-group");
    			add_location(div2, file$7, 84, 20, 2856);
    			attr_dev(label1, "for", "");
    			add_location(label1, file$7, 95, 22, 3338);
    			attr_dev(input1, "class", "form-control form-control-lg");
    			attr_dev(input1, "type", "text");
    			input1.required = true;
    			attr_dev(input1, "placeholder", "Nome do Produto ou Serviço");
    			add_location(input1, file$7, 96, 22, 3390);
    			attr_dev(div3, "class", "form-group");
    			add_location(div3, file$7, 94, 20, 3290);
    			attr_dev(label2, "for", "");
    			add_location(label2, file$7, 105, 22, 3768);
    			attr_dev(input2, "id", "file");
    			attr_dev(input2, "name", "file");
    			attr_dev(input2, "type", "file");
    			add_location(input2, file$7, 106, 22, 3846);
    			attr_dev(div4, "class", "form-group");
    			add_location(div4, file$7, 104, 20, 3720);
    			attr_dev(label3, "for", "");
    			add_location(label3, file$7, 114, 22, 4127);
    			attr_dev(input3, "class", "form-control form-control-lg");
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "placeholder", "Descreva o que você está oferecendo, seja objetivo com o seu cliente.");
    			add_location(input3, file$7, 115, 22, 4182);
    			attr_dev(div5, "class", "form-group");
    			add_location(div5, file$7, 113, 20, 4079);
    			attr_dev(label4, "for", "");
    			add_location(label4, file$7, 123, 22, 4575);
    			attr_dev(input4, "class", "form-control form-control-lg");
    			attr_dev(input4, "type", "tel");
    			add_location(input4, file$7, 124, 22, 4626);
    			attr_dev(div6, "class", "form-group");
    			add_location(div6, file$7, 122, 20, 4527);
    			attr_dev(label5, "for", "");
    			add_location(label5, file$7, 131, 22, 4903);
    			attr_dev(select, "class", "form-control form-control-lg");
    			if (/*link*/ ctx[4].type === void 0) add_render_callback(() => /*select_change_handler*/ ctx[13].call(select));
    			add_location(select, file$7, 132, 22, 4953);
    			attr_dev(div7, "class", "form-group");
    			add_location(div7, file$7, 130, 20, 4855);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "btn btn-lg btn-primary");
    			add_location(button, file$7, 142, 22, 5367);
    			attr_dev(div8, "class", "text-center mt-3");
    			add_location(div8, file$7, 141, 20, 5313);
    			add_location(form, file$7, 83, 18, 2807);
    			attr_dev(div9, "class", "m-sm-4");
    			add_location(div9, file$7, 67, 16, 2173);
    			attr_dev(div10, "class", "card-body");
    			add_location(div10, file$7, 66, 14, 2132);
    			attr_dev(div11, "class", "card");
    			add_location(div11, file$7, 65, 12, 2098);
    			attr_dev(div12, "class", "d-table-cell align-middle");
    			add_location(div12, file$7, 59, 10, 1826);
    			attr_dev(div13, "class", "col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100");
    			add_location(div13, file$7, 58, 8, 1751);
    			attr_dev(div14, "class", "row h-100");
    			add_location(div14, file$7, 57, 6, 1718);
    			attr_dev(div15, "class", "container d-flex flex-column");
    			add_location(div15, file$7, 56, 4, 1668);
    			attr_dev(main, "class", "content d-flex p-0");
    			add_location(main, file$7, 55, 2, 1629);
    			attr_dev(div16, "class", "main d-flex justify-content-center w-100");
    			add_location(div16, file$7, 54, 0, 1571);
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div16, anchor);
    			append_hydration_dev(div16, main);
    			append_hydration_dev(main, div15);
    			append_hydration_dev(div15, div14);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t1);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(div12, t4);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, div1);
    			if_block.m(div1, null);
    			append_hydration_dev(div9, t5);
    			append_hydration_dev(div9, form);
    			append_hydration_dev(form, div2);
    			append_hydration_dev(div2, label0);
    			append_hydration_dev(label0, t6);
    			append_hydration_dev(div2, t7);
    			append_hydration_dev(div2, input0);
    			set_input_value(input0, /*link*/ ctx[4].url);
    			append_hydration_dev(form, t8);
    			append_hydration_dev(form, div3);
    			append_hydration_dev(div3, label1);
    			append_hydration_dev(label1, t9);
    			append_hydration_dev(div3, t10);
    			append_hydration_dev(div3, input1);
    			set_input_value(input1, /*link*/ ctx[4].title);
    			append_hydration_dev(form, t11);
    			append_hydration_dev(form, div4);
    			append_hydration_dev(div4, label2);
    			append_hydration_dev(label2, t12);
    			append_hydration_dev(div4, t13);
    			append_hydration_dev(div4, input2);
    			append_hydration_dev(form, t14);
    			append_hydration_dev(form, div5);
    			append_hydration_dev(div5, label3);
    			append_hydration_dev(label3, t15);
    			append_hydration_dev(div5, t16);
    			append_hydration_dev(div5, input3);
    			set_input_value(input3, /*link*/ ctx[4].description);
    			append_hydration_dev(form, t17);
    			append_hydration_dev(form, div6);
    			append_hydration_dev(div6, label4);
    			append_hydration_dev(label4, t18);
    			append_hydration_dev(div6, t19);
    			append_hydration_dev(div6, input4);
    			set_input_value(input4, /*link*/ ctx[4].price);
    			append_hydration_dev(form, t20);
    			append_hydration_dev(form, div7);
    			append_hydration_dev(div7, label5);
    			append_hydration_dev(label5, t21);
    			append_hydration_dev(div7, t22);
    			append_hydration_dev(div7, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*link*/ ctx[4].type);
    			append_hydration_dev(form, t23);
    			append_hydration_dev(form, div8);
    			append_hydration_dev(div8, button);
    			append_hydration_dev(button, t24);
    			insert_hydration_dev(target, t25, anchor);
    			mount_component(alert, target, anchor);
    			insert_hydration_dev(target, t26, anchor);
    			mount_component(footer, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[10]),
    					listen_dev(input2, "change", /*drop*/ ctx[7], false, false, false),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[11]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[12]),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[13]),
    					listen_dev(form, "submit", /*dispatch*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const navbar_changes = {};
    			if (dirty & /*user*/ 32) navbar_changes.user = /*user*/ ctx[5];
    			navbar.$set(navbar_changes);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}

    			if (dirty & /*link, types*/ 80 && input0.value !== /*link*/ ctx[4].url) {
    				set_input_value(input0, /*link*/ ctx[4].url);
    			}

    			if (dirty & /*link, types*/ 80 && input1.value !== /*link*/ ctx[4].title) {
    				set_input_value(input1, /*link*/ ctx[4].title);
    			}

    			if (dirty & /*link, types*/ 80 && input3.value !== /*link*/ ctx[4].description) {
    				set_input_value(input3, /*link*/ ctx[4].description);
    			}

    			if (dirty & /*link, types*/ 80) {
    				set_input_value(input4, /*link*/ ctx[4].price);
    			}

    			if (dirty & /*types*/ 64) {
    				each_value = /*types*/ ctx[6];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$2, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, select, destroy_block, create_each_block$2, null, get_each_context$2);
    			}

    			if (dirty & /*link, types*/ 80) {
    				select_option(select, /*link*/ ctx[4].type);
    			}

    			const alert_changes = {};
    			if (dirty & /*mssg*/ 4) alert_changes.mssg = /*mssg*/ ctx[2];
    			if (dirty & /*status*/ 2) alert_changes.status = /*status*/ ctx[1];
    			alert.$set(alert_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(alert.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(alert.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div16);
    			if_block.d();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching) detach_dev(t25);
    			destroy_component(alert, detaching);
    			if (detaching) detach_dev(t26);
    			destroy_component(footer, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('EditLink', slots, []);
    	let loading = false;
    	let status = -1;
    	let mssg = "";
    	let image = "https://www.lifewire.com/thmb/P856-0hi4lmA2xinYWyaEpRIckw=/1920x1326/filters:no_upscale():max_bytes(150000):strip_icc()/cloud-upload-a30f385a928e44e199a62210d578375a.jpg";
    	let link;
    	let user;
    	let types = ['Serviço', 'Produto'];

    	const unsubscribe = userStore.subscribe(data => {
    		console.log(data);
    		$$invalidate(4, link = data.link);
    		$$invalidate(5, user = data.user);

    		$$invalidate(3, image = link.image != "" || link.image != null
    		? link.image
    		: image);
    	});

    	const drop = async e => {
    		$$invalidate(0, loading = true);
    		const files = e.target.files;
    		const data = new FormData();
    		data.append("file", files[0]);
    		data.append("upload_preset", "vitrinedacasa");
    		const res = await fetch("https://api.cloudinary.com/v1_1/sankarkvs/image/upload", { method: "POST", body: data });
    		$$invalidate(0, loading = false);
    		const file = await res.json();
    		$$invalidate(4, link.image = file.secure_url, link);
    		$$invalidate(3, image = file.secure_url);
    	};

    	const dispatch = async e => {
    		e.preventDefault();
    		let res = await addlink(link);
    		$$invalidate(1, status = res.status);
    		$$invalidate(2, mssg = res.mssg);
    		console.log(res);
    		document.location.href = "/dashboard";
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$4.warn(`<EditLink> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		link.url = this.value;
    		$$invalidate(4, link);
    		$$invalidate(6, types);
    	}

    	function input1_input_handler() {
    		link.title = this.value;
    		$$invalidate(4, link);
    		$$invalidate(6, types);
    	}

    	function input3_input_handler() {
    		link.description = this.value;
    		$$invalidate(4, link);
    		$$invalidate(6, types);
    	}

    	function input4_input_handler() {
    		link.price = this.value;
    		$$invalidate(4, link);
    		$$invalidate(6, types);
    	}

    	function select_change_handler() {
    		link.type = select_value(this);
    		$$invalidate(4, link);
    		$$invalidate(6, types);
    	}

    	$$self.$capture_state = () => ({
    		Alert,
    		addlink,
    		userStore,
    		NavBar: Navbar,
    		Footer,
    		loading,
    		status,
    		mssg,
    		image,
    		link,
    		user,
    		types,
    		unsubscribe,
    		drop,
    		dispatch
    	});

    	$$self.$inject_state = $$props => {
    		if ('loading' in $$props) $$invalidate(0, loading = $$props.loading);
    		if ('status' in $$props) $$invalidate(1, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(2, mssg = $$props.mssg);
    		if ('image' in $$props) $$invalidate(3, image = $$props.image);
    		if ('link' in $$props) $$invalidate(4, link = $$props.link);
    		if ('user' in $$props) $$invalidate(5, user = $$props.user);
    		if ('types' in $$props) $$invalidate(6, types = $$props.types);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		loading,
    		status,
    		mssg,
    		image,
    		link,
    		user,
    		types,
    		drop,
    		dispatch,
    		input0_input_handler,
    		input1_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		select_change_handler
    	];
    }

    class EditLink extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "EditLink",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src\pages\AddSchedule.svelte generated by Svelte v3.47.0 */

    const { console: console_1$3 } = globals;
    const file$6 = "src\\pages\\AddSchedule.svelte";

    // (64:20) {:else}
    function create_else_block$2(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			img = claim_element(nodes, "IMG", {
    				src: true,
    				alt: true,
    				class: true,
    				width: true,
    				height: true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*image*/ ctx[3])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Not found user");
    			attr_dev(img, "class", "img-fluid");
    			attr_dev(img, "width", "132");
    			attr_dev(img, "height", "132");
    			add_location(img, file$6, 64, 22, 2141);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*image*/ 8 && !src_url_equal(img.src, img_src_value = /*image*/ ctx[3])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(64:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (60:20) {#if loading}
    function create_if_block$3(ctx) {
    	let div;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t = text("Carregando...");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, role: true });
    			var div_nodes = children(div);
    			span = claim_element(div_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "Carregando...");
    			span_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "sr-only");
    			add_location(span, file$6, 61, 24, 2016);
    			attr_dev(div, "class", "spinner-border text-primary");
    			attr_dev(div, "role", "status");
    			add_location(div, file$6, 60, 22, 1935);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, span);
    			append_hydration_dev(span, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(60:20) {#if loading}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div14;
    	let main;
    	let div13;
    	let div12;
    	let div11;
    	let div10;
    	let div0;
    	let h1;
    	let t0;
    	let t1;
    	let p;
    	let t2;
    	let t3;
    	let div9;
    	let div8;
    	let div7;
    	let div1;
    	let t4;
    	let form;
    	let div2;
    	let label0;
    	let t5;
    	let t6;
    	let input0;
    	let t7;
    	let div3;
    	let label1;
    	let t8;
    	let t9;
    	let input1;
    	let t10;
    	let div4;
    	let label2;
    	let t11;
    	let t12;
    	let textarea;
    	let t13;
    	let div5;
    	let label3;
    	let t14;
    	let t15;
    	let input2;
    	let t16;
    	let div6;
    	let button;
    	let t17;
    	let t18;
    	let alert;
    	let current;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[0]) return create_if_block$3;
    		return create_else_block$2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	alert = new Alert({
    			props: {
    				mssg: /*mssg*/ ctx[2],
    				status: /*status*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div14 = element("div");
    			main = element("main");
    			div13 = element("div");
    			div12 = element("div");
    			div11 = element("div");
    			div10 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("Abra uma agenda para seus clientes");
    			t1 = space();
    			p = element("p");
    			t2 = text("Digite os detalhes");
    			t3 = space();
    			div9 = element("div");
    			div8 = element("div");
    			div7 = element("div");
    			div1 = element("div");
    			if_block.c();
    			t4 = space();
    			form = element("form");
    			div2 = element("div");
    			label0 = element("label");
    			t5 = text("Titulo");
    			t6 = space();
    			input0 = element("input");
    			t7 = space();
    			div3 = element("div");
    			label1 = element("label");
    			t8 = text("Url");
    			t9 = space();
    			input1 = element("input");
    			t10 = space();
    			div4 = element("div");
    			label2 = element("label");
    			t11 = text("Descrição");
    			t12 = space();
    			textarea = element("textarea");
    			t13 = space();
    			div5 = element("div");
    			label3 = element("label");
    			t14 = text("Carregue uma imagem (se desejar)");
    			t15 = space();
    			input2 = element("input");
    			t16 = space();
    			div6 = element("div");
    			button = element("button");
    			t17 = text("Criar Página");
    			t18 = space();
    			create_component(alert.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div14 = claim_element(nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			main = claim_element(div14_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div13 = claim_element(main_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div0 = claim_element(div10_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "Abra uma agenda para seus clientes");
    			h1_nodes.forEach(detach_dev);
    			t1 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t2 = claim_text(p_nodes, "Digite os detalhes");
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t3 = claim_space(div10_nodes);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div1 = claim_element(div7_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t4 = claim_space(div7_nodes);
    			form = claim_element(div7_nodes, "FORM", {});
    			var form_nodes = children(form);
    			div2 = claim_element(form_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			label0 = claim_element(div2_nodes, "LABEL", { for: true });
    			var label0_nodes = children(label0);
    			t5 = claim_text(label0_nodes, "Titulo");
    			label0_nodes.forEach(detach_dev);
    			t6 = claim_space(div2_nodes);

    			input0 = claim_element(div2_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div2_nodes.forEach(detach_dev);
    			t7 = claim_space(form_nodes);
    			div3 = claim_element(form_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			label1 = claim_element(div3_nodes, "LABEL", { for: true });
    			var label1_nodes = children(label1);
    			t8 = claim_text(label1_nodes, "Url");
    			label1_nodes.forEach(detach_dev);
    			t9 = claim_space(div3_nodes);

    			input1 = claim_element(div3_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div3_nodes.forEach(detach_dev);
    			t10 = claim_space(form_nodes);
    			div4 = claim_element(form_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			label2 = claim_element(div4_nodes, "LABEL", { for: true });
    			var label2_nodes = children(label2);
    			t11 = claim_text(label2_nodes, "Descrição");
    			label2_nodes.forEach(detach_dev);
    			t12 = claim_space(div4_nodes);
    			textarea = claim_element(div4_nodes, "TEXTAREA", { class: true, placeholder: true });
    			children(textarea).forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t13 = claim_space(form_nodes);
    			div5 = claim_element(form_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			label3 = claim_element(div5_nodes, "LABEL", { for: true });
    			var label3_nodes = children(label3);
    			t14 = claim_text(label3_nodes, "Carregue uma imagem (se desejar)");
    			label3_nodes.forEach(detach_dev);
    			t15 = claim_space(div5_nodes);
    			input2 = claim_element(div5_nodes, "INPUT", { id: true, name: true, type: true });
    			div5_nodes.forEach(detach_dev);
    			t16 = claim_space(form_nodes);
    			div6 = claim_element(form_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			button = claim_element(div6_nodes, "BUTTON", { type: true, class: true });
    			var button_nodes = children(button);
    			t17 = claim_text(button_nodes, "Criar Página");
    			button_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			t18 = claim_space(nodes);
    			claim_component(alert.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "h2");
    			add_location(h1, file$6, 51, 14, 1592);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$6, 52, 14, 1662);
    			attr_dev(div0, "class", "text-center mt-4");
    			add_location(div0, file$6, 50, 12, 1546);
    			attr_dev(div1, "class", "text-center");
    			add_location(div1, file$6, 58, 18, 1851);
    			attr_dev(label0, "for", "");
    			add_location(label0, file$6, 75, 22, 2542);
    			attr_dev(input0, "class", "form-control form-control-lg");
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "placeholder", "Produto ou Serviço");
    			add_location(input0, file$6, 76, 22, 2594);
    			attr_dev(div2, "class", "form-group");
    			add_location(div2, file$6, 74, 20, 2494);
    			attr_dev(label1, "for", "");
    			add_location(label1, file$6, 85, 22, 2968);
    			attr_dev(input1, "class", "form-control form-control-lg");
    			attr_dev(input1, "type", "text");
    			input1.required = true;
    			attr_dev(input1, "placeholder", "https://vitrinedacasa.com.br/usuario/urldoproduto");
    			add_location(input1, file$6, 86, 22, 3017);
    			attr_dev(div3, "class", "form-group");
    			add_location(div3, file$6, 84, 20, 2920);
    			attr_dev(label2, "for", "");
    			add_location(label2, file$6, 95, 22, 3420);
    			attr_dev(textarea, "class", "form-control form-control-lg");
    			attr_dev(textarea, "placeholder", "Descreva o que você está oferecendo, seja objetivo com o seu cliente.");
    			add_location(textarea, file$6, 96, 22, 3475);
    			attr_dev(div4, "class", "form-group");
    			add_location(div4, file$6, 94, 20, 3372);
    			attr_dev(label3, "for", "");
    			add_location(label3, file$6, 103, 22, 3838);
    			attr_dev(input2, "id", "file");
    			attr_dev(input2, "name", "file");
    			attr_dev(input2, "type", "file");
    			add_location(input2, file$6, 104, 22, 3916);
    			attr_dev(div5, "class", "form-group");
    			add_location(div5, file$6, 102, 20, 3790);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "btn btn-lg btn-primary");
    			add_location(button, file$6, 112, 22, 4203);
    			attr_dev(div6, "class", "text-center mt-3");
    			add_location(div6, file$6, 111, 20, 4149);
    			add_location(form, file$6, 73, 18, 2445);
    			attr_dev(div7, "class", "m-sm-4");
    			add_location(div7, file$6, 57, 16, 1811);
    			attr_dev(div8, "class", "card-body");
    			add_location(div8, file$6, 56, 14, 1770);
    			attr_dev(div9, "class", "card");
    			add_location(div9, file$6, 55, 12, 1736);
    			attr_dev(div10, "class", "d-table-cell align-middle");
    			add_location(div10, file$6, 49, 10, 1493);
    			attr_dev(div11, "class", "col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100");
    			add_location(div11, file$6, 48, 8, 1418);
    			attr_dev(div12, "class", "row h-100");
    			add_location(div12, file$6, 47, 6, 1385);
    			attr_dev(div13, "class", "container d-flex flex-column");
    			add_location(div13, file$6, 46, 4, 1335);
    			attr_dev(main, "class", "content d-flex p-0");
    			add_location(main, file$6, 45, 2, 1296);
    			attr_dev(div14, "class", "main d-flex justify-content-center w-100");
    			add_location(div14, file$6, 44, 0, 1238);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div14, anchor);
    			append_hydration_dev(div14, main);
    			append_hydration_dev(main, div13);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t2);
    			append_hydration_dev(div10, t3);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, div1);
    			if_block.m(div1, null);
    			append_hydration_dev(div7, t4);
    			append_hydration_dev(div7, form);
    			append_hydration_dev(form, div2);
    			append_hydration_dev(div2, label0);
    			append_hydration_dev(label0, t5);
    			append_hydration_dev(div2, t6);
    			append_hydration_dev(div2, input0);
    			set_input_value(input0, /*schedule*/ ctx[4].title);
    			append_hydration_dev(form, t7);
    			append_hydration_dev(form, div3);
    			append_hydration_dev(div3, label1);
    			append_hydration_dev(label1, t8);
    			append_hydration_dev(div3, t9);
    			append_hydration_dev(div3, input1);
    			set_input_value(input1, /*schedule*/ ctx[4].url);
    			append_hydration_dev(form, t10);
    			append_hydration_dev(form, div4);
    			append_hydration_dev(div4, label2);
    			append_hydration_dev(label2, t11);
    			append_hydration_dev(div4, t12);
    			append_hydration_dev(div4, textarea);
    			set_input_value(textarea, /*schedule*/ ctx[4].description);
    			append_hydration_dev(form, t13);
    			append_hydration_dev(form, div5);
    			append_hydration_dev(div5, label3);
    			append_hydration_dev(label3, t14);
    			append_hydration_dev(div5, t15);
    			append_hydration_dev(div5, input2);
    			append_hydration_dev(form, t16);
    			append_hydration_dev(form, div6);
    			append_hydration_dev(div6, button);
    			append_hydration_dev(button, t17);
    			insert_hydration_dev(target, t18, anchor);
    			mount_component(alert, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[7]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[8]),
    					listen_dev(textarea, "input", /*textarea_input_handler*/ ctx[9]),
    					listen_dev(input2, "change", /*drop*/ ctx[5], false, false, false),
    					listen_dev(form, "submit", /*dispatch*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}

    			if (dirty & /*schedule*/ 16 && input0.value !== /*schedule*/ ctx[4].title) {
    				set_input_value(input0, /*schedule*/ ctx[4].title);
    			}

    			if (dirty & /*schedule*/ 16 && input1.value !== /*schedule*/ ctx[4].url) {
    				set_input_value(input1, /*schedule*/ ctx[4].url);
    			}

    			if (dirty & /*schedule*/ 16) {
    				set_input_value(textarea, /*schedule*/ ctx[4].description);
    			}

    			const alert_changes = {};
    			if (dirty & /*mssg*/ 4) alert_changes.mssg = /*mssg*/ ctx[2];
    			if (dirty & /*status*/ 2) alert_changes.status = /*status*/ ctx[1];
    			alert.$set(alert_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(alert.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(alert.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div14);
    			if_block.d();
    			if (detaching) detach_dev(t18);
    			destroy_component(alert, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('AddSchedule', slots, []);
    	let loading = false;
    	let status = -1;
    	let mssg = "";
    	let image = "https://www.lifewire.com/thmb/P856-0hi4lmA2xinYWyaEpRIckw=/1920x1326/filters:no_upscale():max_bytes(150000):strip_icc()/cloud-upload-a30f385a928e44e199a62210d578375a.jpg";

    	let schedule = {
    		url: "",
    		title: "",
    		image: "",
    		description: "",
    		clicks: 0,
    		likes: 0
    	};

    	const drop = async e => {
    		$$invalidate(0, loading = true);
    		const files = e.target.files;
    		const data = new FormData();
    		data.append("file", files[0]);
    		data.append("upload_preset", "vitrinedacasa");
    		const res = await fetch("https://api.cloudinary.com/v1_1/sankarkvs/image/upload", { method: "POST", body: data });
    		$$invalidate(0, loading = false);
    		const file = await res.json();
    		$$invalidate(4, schedule.image = file.secure_url, schedule);
    		$$invalidate(3, image = file.secure_url);
    	};

    	const dispatch = async e => {
    		e.preventDefault();
    		let res = await addschedule(schedule);
    		$$invalidate(1, status = res.status);
    		$$invalidate(2, mssg = res.mssg);
    		console.log(res);
    		document.location.href = "/dashboard";
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$3.warn(`<AddSchedule> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		schedule.title = this.value;
    		$$invalidate(4, schedule);
    	}

    	function input1_input_handler() {
    		schedule.url = this.value;
    		$$invalidate(4, schedule);
    	}

    	function textarea_input_handler() {
    		schedule.description = this.value;
    		$$invalidate(4, schedule);
    	}

    	$$self.$capture_state = () => ({
    		Alert,
    		addschedule,
    		loading,
    		status,
    		mssg,
    		image,
    		schedule,
    		drop,
    		dispatch
    	});

    	$$self.$inject_state = $$props => {
    		if ('loading' in $$props) $$invalidate(0, loading = $$props.loading);
    		if ('status' in $$props) $$invalidate(1, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(2, mssg = $$props.mssg);
    		if ('image' in $$props) $$invalidate(3, image = $$props.image);
    		if ('schedule' in $$props) $$invalidate(4, schedule = $$props.schedule);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		loading,
    		status,
    		mssg,
    		image,
    		schedule,
    		drop,
    		dispatch,
    		input0_input_handler,
    		input1_input_handler,
    		textarea_input_handler
    	];
    }

    class AddSchedule extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "AddSchedule",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src\pages\EditSchedule.svelte generated by Svelte v3.47.0 */

    const { console: console_1$2 } = globals;
    const file$5 = "src\\pages\\EditSchedule.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    // (74:20) {:else}
    function create_else_block$1(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			img = claim_element(nodes, "IMG", {
    				src: true,
    				alt: true,
    				class: true,
    				width: true,
    				height: true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*image*/ ctx[3])) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Not found user");
    			attr_dev(img, "class", "img-fluid");
    			attr_dev(img, "width", "132");
    			attr_dev(img, "height", "132");
    			add_location(img, file$5, 74, 22, 2543);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*image*/ 8 && !src_url_equal(img.src, img_src_value = /*image*/ ctx[3])) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(74:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (70:20) {#if loading}
    function create_if_block$2(ctx) {
    	let div;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t = text("Carregando...");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true, role: true });
    			var div_nodes = children(div);
    			span = claim_element(div_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "Carregando...");
    			span_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "sr-only");
    			add_location(span, file$5, 71, 24, 2418);
    			attr_dev(div, "class", "spinner-border text-primary");
    			attr_dev(div, "role", "status");
    			add_location(div, file$5, 70, 22, 2337);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, span);
    			append_hydration_dev(span, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(70:20) {#if loading}",
    		ctx
    	});

    	return block;
    }

    // (137:23) {#each types as type(type)}
    function create_each_block$1(key_1, ctx) {
    	let option;
    	let t_value = /*type*/ ctx[15] + "";
    	let t;

    	const block = {
    		key: key_1,
    		first: null,
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			option = claim_element(nodes, "OPTION", {});
    			var option_nodes = children(option);
    			t = claim_text(option_nodes, t_value);
    			option_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			option.__value = /*type*/ ctx[15];
    			option.value = option.__value;
    			add_location(option, file$5, 137, 26, 5235);
    			this.first = option;
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, option, anchor);
    			append_hydration_dev(option, t);
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(137:23) {#each types as type(type)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let navbar;
    	let t0;
    	let div16;
    	let main;
    	let div15;
    	let div14;
    	let div13;
    	let div12;
    	let div0;
    	let h1;
    	let t1;
    	let t2;
    	let p;
    	let t3;
    	let t4;
    	let div11;
    	let div10;
    	let div9;
    	let div1;
    	let t5;
    	let form;
    	let div2;
    	let label0;
    	let t6;
    	let t7;
    	let input0;
    	let t8;
    	let div3;
    	let label1;
    	let t9;
    	let t10;
    	let input1;
    	let t11;
    	let div4;
    	let label2;
    	let t12;
    	let t13;
    	let input2;
    	let t14;
    	let div5;
    	let label3;
    	let t15;
    	let t16;
    	let input3;
    	let t17;
    	let div6;
    	let label4;
    	let t18;
    	let t19;
    	let input4;
    	let t20;
    	let div7;
    	let label5;
    	let t21;
    	let t22;
    	let select;
    	let each_blocks = [];
    	let each_1_lookup = new Map();
    	let t23;
    	let div8;
    	let button;
    	let t24;
    	let t25;
    	let alert;
    	let t26;
    	let footer;
    	let current;
    	let mounted;
    	let dispose;

    	navbar = new Navbar({
    			props: { user: /*user*/ ctx[5] },
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*loading*/ ctx[0]) return create_if_block$2;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value = /*types*/ ctx[6];
    	validate_each_argument(each_value);
    	const get_key = ctx => /*type*/ ctx[15];
    	validate_each_keys(ctx, each_value, get_each_context$1, get_key);

    	for (let i = 0; i < each_value.length; i += 1) {
    		let child_ctx = get_each_context$1(ctx, each_value, i);
    		let key = get_key(child_ctx);
    		each_1_lookup.set(key, each_blocks[i] = create_each_block$1(key, child_ctx));
    	}

    	alert = new Alert({
    			props: {
    				mssg: /*mssg*/ ctx[2],
    				status: /*status*/ ctx[1]
    			},
    			$$inline: true
    		});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(navbar.$$.fragment);
    			t0 = space();
    			div16 = element("div");
    			main = element("main");
    			div15 = element("div");
    			div14 = element("div");
    			div13 = element("div");
    			div12 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t1 = text("Multiplique as possibilidades");
    			t2 = space();
    			p = element("p");
    			t3 = text("Uma página personalizada para seu Produto ou Serviço");
    			t4 = space();
    			div11 = element("div");
    			div10 = element("div");
    			div9 = element("div");
    			div1 = element("div");
    			if_block.c();
    			t5 = space();
    			form = element("form");
    			div2 = element("div");
    			label0 = element("label");
    			t6 = text("Url");
    			t7 = space();
    			input0 = element("input");
    			t8 = space();
    			div3 = element("div");
    			label1 = element("label");
    			t9 = text("Título");
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			div4 = element("div");
    			label2 = element("label");
    			t12 = text("Carregue uma imagem (se desejar)");
    			t13 = space();
    			input2 = element("input");
    			t14 = space();
    			div5 = element("div");
    			label3 = element("label");
    			t15 = text("Descrição");
    			t16 = space();
    			input3 = element("input");
    			t17 = space();
    			div6 = element("div");
    			label4 = element("label");
    			t18 = text("Preço");
    			t19 = space();
    			input4 = element("input");
    			t20 = space();
    			div7 = element("div");
    			label5 = element("label");
    			t21 = text("Tipo");
    			t22 = space();
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t23 = space();
    			div8 = element("div");
    			button = element("button");
    			t24 = text("Salvar");
    			t25 = space();
    			create_component(alert.$$.fragment);
    			t26 = space();
    			create_component(footer.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			claim_component(navbar.$$.fragment, nodes);
    			t0 = claim_space(nodes);
    			div16 = claim_element(nodes, "DIV", { class: true });
    			var div16_nodes = children(div16);
    			main = claim_element(div16_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div15 = claim_element(main_nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			div14 = claim_element(div15_nodes, "DIV", { class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div0 = claim_element(div12_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t1 = claim_text(h1_nodes, "Multiplique as possibilidades");
    			h1_nodes.forEach(detach_dev);
    			t2 = claim_space(div0_nodes);
    			p = claim_element(div0_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t3 = claim_text(p_nodes, "Uma página personalizada para seu Produto ou Serviço");
    			p_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t4 = claim_space(div12_nodes);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			div10 = claim_element(div11_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div1 = claim_element(div9_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t5 = claim_space(div9_nodes);
    			form = claim_element(div9_nodes, "FORM", {});
    			var form_nodes = children(form);
    			div2 = claim_element(form_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			label0 = claim_element(div2_nodes, "LABEL", { for: true });
    			var label0_nodes = children(label0);
    			t6 = claim_text(label0_nodes, "Url");
    			label0_nodes.forEach(detach_dev);
    			t7 = claim_space(div2_nodes);

    			input0 = claim_element(div2_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div2_nodes.forEach(detach_dev);
    			t8 = claim_space(form_nodes);
    			div3 = claim_element(form_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			label1 = claim_element(div3_nodes, "LABEL", { for: true });
    			var label1_nodes = children(label1);
    			t9 = claim_text(label1_nodes, "Título");
    			label1_nodes.forEach(detach_dev);
    			t10 = claim_space(div3_nodes);

    			input1 = claim_element(div3_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div3_nodes.forEach(detach_dev);
    			t11 = claim_space(form_nodes);
    			div4 = claim_element(form_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			label2 = claim_element(div4_nodes, "LABEL", { for: true });
    			var label2_nodes = children(label2);
    			t12 = claim_text(label2_nodes, "Carregue uma imagem (se desejar)");
    			label2_nodes.forEach(detach_dev);
    			t13 = claim_space(div4_nodes);
    			input2 = claim_element(div4_nodes, "INPUT", { id: true, name: true, type: true });
    			div4_nodes.forEach(detach_dev);
    			t14 = claim_space(form_nodes);
    			div5 = claim_element(form_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			label3 = claim_element(div5_nodes, "LABEL", { for: true });
    			var label3_nodes = children(label3);
    			t15 = claim_text(label3_nodes, "Descrição");
    			label3_nodes.forEach(detach_dev);
    			t16 = claim_space(div5_nodes);

    			input3 = claim_element(div5_nodes, "INPUT", {
    				class: true,
    				type: true,
    				placeholder: true
    			});

    			div5_nodes.forEach(detach_dev);
    			t17 = claim_space(form_nodes);
    			div6 = claim_element(form_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			label4 = claim_element(div6_nodes, "LABEL", { for: true });
    			var label4_nodes = children(label4);
    			t18 = claim_text(label4_nodes, "Preço");
    			label4_nodes.forEach(detach_dev);
    			t19 = claim_space(div6_nodes);
    			input4 = claim_element(div6_nodes, "INPUT", { class: true, type: true });
    			div6_nodes.forEach(detach_dev);
    			t20 = claim_space(form_nodes);
    			div7 = claim_element(form_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			label5 = claim_element(div7_nodes, "LABEL", { for: true });
    			var label5_nodes = children(label5);
    			t21 = claim_text(label5_nodes, "Tipo");
    			label5_nodes.forEach(detach_dev);
    			t22 = claim_space(div7_nodes);
    			select = claim_element(div7_nodes, "SELECT", { class: true });
    			var select_nodes = children(select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(select_nodes);
    			}

    			select_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			t23 = claim_space(form_nodes);
    			div8 = claim_element(form_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			button = claim_element(div8_nodes, "BUTTON", { type: true, class: true });
    			var button_nodes = children(button);
    			t24 = claim_text(button_nodes, "Salvar");
    			button_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			div16_nodes.forEach(detach_dev);
    			t25 = claim_space(nodes);
    			claim_component(alert.$$.fragment, nodes);
    			t26 = claim_space(nodes);
    			claim_component(footer.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "h2");
    			add_location(h1, file$5, 61, 14, 1965);
    			attr_dev(p, "class", "lead");
    			add_location(p, file$5, 62, 14, 2030);
    			attr_dev(div0, "class", "text-center mt-4");
    			add_location(div0, file$5, 60, 12, 1919);
    			attr_dev(div1, "class", "text-center");
    			add_location(div1, file$5, 68, 18, 2253);
    			attr_dev(label0, "for", "");
    			add_location(label0, file$5, 85, 22, 2944);
    			attr_dev(input0, "class", "form-control form-control-lg");
    			attr_dev(input0, "type", "text");
    			input0.required = true;
    			attr_dev(input0, "placeholder", "https://itesmesankar.herokuapp.com/");
    			add_location(input0, file$5, 86, 22, 2993);
    			attr_dev(div2, "class", "form-group");
    			add_location(div2, file$5, 84, 20, 2896);
    			attr_dev(label1, "for", "");
    			add_location(label1, file$5, 95, 22, 3382);
    			attr_dev(input1, "class", "form-control form-control-lg");
    			attr_dev(input1, "type", "text");
    			input1.required = true;
    			attr_dev(input1, "placeholder", "Nome do Produto ou Serviço");
    			add_location(input1, file$5, 96, 22, 3434);
    			attr_dev(div3, "class", "form-group");
    			add_location(div3, file$5, 94, 20, 3334);
    			attr_dev(label2, "for", "");
    			add_location(label2, file$5, 105, 22, 3816);
    			attr_dev(input2, "id", "file");
    			attr_dev(input2, "name", "file");
    			attr_dev(input2, "type", "file");
    			add_location(input2, file$5, 106, 22, 3894);
    			attr_dev(div4, "class", "form-group");
    			add_location(div4, file$5, 104, 20, 3768);
    			attr_dev(label3, "for", "");
    			add_location(label3, file$5, 114, 22, 4175);
    			attr_dev(input3, "class", "form-control form-control-lg");
    			attr_dev(input3, "type", "text");
    			attr_dev(input3, "placeholder", "Descreva o que você está oferecendo, seja objetivo com o seu cliente.");
    			add_location(input3, file$5, 115, 22, 4230);
    			attr_dev(div5, "class", "form-group");
    			add_location(div5, file$5, 113, 20, 4127);
    			attr_dev(label4, "for", "");
    			add_location(label4, file$5, 123, 22, 4627);
    			attr_dev(input4, "class", "form-control form-control-lg");
    			attr_dev(input4, "type", "tel");
    			add_location(input4, file$5, 124, 22, 4678);
    			attr_dev(div6, "class", "form-group");
    			add_location(div6, file$5, 122, 20, 4579);
    			attr_dev(label5, "for", "");
    			add_location(label5, file$5, 131, 22, 4959);
    			attr_dev(select, "class", "form-control form-control-lg");
    			if (/*schedule*/ ctx[4].type === void 0) add_render_callback(() => /*select_change_handler*/ ctx[13].call(select));
    			add_location(select, file$5, 132, 22, 5009);
    			attr_dev(div7, "class", "form-group");
    			add_location(div7, file$5, 130, 20, 4911);
    			attr_dev(button, "type", "submit");
    			attr_dev(button, "class", "btn btn-lg btn-primary");
    			add_location(button, file$5, 142, 22, 5427);
    			attr_dev(div8, "class", "text-center mt-3");
    			add_location(div8, file$5, 141, 20, 5373);
    			add_location(form, file$5, 83, 18, 2847);
    			attr_dev(div9, "class", "m-sm-4");
    			add_location(div9, file$5, 67, 16, 2213);
    			attr_dev(div10, "class", "card-body");
    			add_location(div10, file$5, 66, 14, 2172);
    			attr_dev(div11, "class", "card");
    			add_location(div11, file$5, 65, 12, 2138);
    			attr_dev(div12, "class", "d-table-cell align-middle");
    			add_location(div12, file$5, 59, 10, 1866);
    			attr_dev(div13, "class", "col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100");
    			add_location(div13, file$5, 58, 8, 1791);
    			attr_dev(div14, "class", "row h-100");
    			add_location(div14, file$5, 57, 6, 1758);
    			attr_dev(div15, "class", "container d-flex flex-column");
    			add_location(div15, file$5, 56, 4, 1708);
    			attr_dev(main, "class", "content d-flex p-0");
    			add_location(main, file$5, 55, 2, 1669);
    			attr_dev(div16, "class", "main d-flex justify-content-center w-100");
    			add_location(div16, file$5, 54, 0, 1611);
    		},
    		m: function mount(target, anchor) {
    			mount_component(navbar, target, anchor);
    			insert_hydration_dev(target, t0, anchor);
    			insert_hydration_dev(target, div16, anchor);
    			append_hydration_dev(div16, main);
    			append_hydration_dev(main, div15);
    			append_hydration_dev(div15, div14);
    			append_hydration_dev(div14, div13);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t1);
    			append_hydration_dev(div0, t2);
    			append_hydration_dev(div0, p);
    			append_hydration_dev(p, t3);
    			append_hydration_dev(div12, t4);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, div10);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, div1);
    			if_block.m(div1, null);
    			append_hydration_dev(div9, t5);
    			append_hydration_dev(div9, form);
    			append_hydration_dev(form, div2);
    			append_hydration_dev(div2, label0);
    			append_hydration_dev(label0, t6);
    			append_hydration_dev(div2, t7);
    			append_hydration_dev(div2, input0);
    			set_input_value(input0, /*schedule*/ ctx[4].url);
    			append_hydration_dev(form, t8);
    			append_hydration_dev(form, div3);
    			append_hydration_dev(div3, label1);
    			append_hydration_dev(label1, t9);
    			append_hydration_dev(div3, t10);
    			append_hydration_dev(div3, input1);
    			set_input_value(input1, /*schedule*/ ctx[4].title);
    			append_hydration_dev(form, t11);
    			append_hydration_dev(form, div4);
    			append_hydration_dev(div4, label2);
    			append_hydration_dev(label2, t12);
    			append_hydration_dev(div4, t13);
    			append_hydration_dev(div4, input2);
    			append_hydration_dev(form, t14);
    			append_hydration_dev(form, div5);
    			append_hydration_dev(div5, label3);
    			append_hydration_dev(label3, t15);
    			append_hydration_dev(div5, t16);
    			append_hydration_dev(div5, input3);
    			set_input_value(input3, /*schedule*/ ctx[4].description);
    			append_hydration_dev(form, t17);
    			append_hydration_dev(form, div6);
    			append_hydration_dev(div6, label4);
    			append_hydration_dev(label4, t18);
    			append_hydration_dev(div6, t19);
    			append_hydration_dev(div6, input4);
    			set_input_value(input4, /*schedule*/ ctx[4].price);
    			append_hydration_dev(form, t20);
    			append_hydration_dev(form, div7);
    			append_hydration_dev(div7, label5);
    			append_hydration_dev(label5, t21);
    			append_hydration_dev(div7, t22);
    			append_hydration_dev(div7, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*schedule*/ ctx[4].type);
    			append_hydration_dev(form, t23);
    			append_hydration_dev(form, div8);
    			append_hydration_dev(div8, button);
    			append_hydration_dev(button, t24);
    			insert_hydration_dev(target, t25, anchor);
    			mount_component(alert, target, anchor);
    			insert_hydration_dev(target, t26, anchor);
    			mount_component(footer, target, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[9]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[10]),
    					listen_dev(input2, "change", /*drop*/ ctx[7], false, false, false),
    					listen_dev(input3, "input", /*input3_input_handler*/ ctx[11]),
    					listen_dev(input4, "input", /*input4_input_handler*/ ctx[12]),
    					listen_dev(select, "change", /*select_change_handler*/ ctx[13]),
    					listen_dev(form, "submit", /*dispatch*/ ctx[8], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const navbar_changes = {};
    			if (dirty & /*user*/ 32) navbar_changes.user = /*user*/ ctx[5];
    			navbar.$set(navbar_changes);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}

    			if (dirty & /*schedule, types*/ 80 && input0.value !== /*schedule*/ ctx[4].url) {
    				set_input_value(input0, /*schedule*/ ctx[4].url);
    			}

    			if (dirty & /*schedule, types*/ 80 && input1.value !== /*schedule*/ ctx[4].title) {
    				set_input_value(input1, /*schedule*/ ctx[4].title);
    			}

    			if (dirty & /*schedule, types*/ 80 && input3.value !== /*schedule*/ ctx[4].description) {
    				set_input_value(input3, /*schedule*/ ctx[4].description);
    			}

    			if (dirty & /*schedule, types*/ 80) {
    				set_input_value(input4, /*schedule*/ ctx[4].price);
    			}

    			if (dirty & /*types*/ 64) {
    				each_value = /*types*/ ctx[6];
    				validate_each_argument(each_value);
    				validate_each_keys(ctx, each_value, get_each_context$1, get_key);
    				each_blocks = update_keyed_each(each_blocks, dirty, get_key, 1, ctx, each_value, each_1_lookup, select, destroy_block, create_each_block$1, null, get_each_context$1);
    			}

    			if (dirty & /*schedule, types*/ 80) {
    				select_option(select, /*schedule*/ ctx[4].type);
    			}

    			const alert_changes = {};
    			if (dirty & /*mssg*/ 4) alert_changes.mssg = /*mssg*/ ctx[2];
    			if (dirty & /*status*/ 2) alert_changes.status = /*status*/ ctx[1];
    			alert.$set(alert_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(navbar.$$.fragment, local);
    			transition_in(alert.$$.fragment, local);
    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(navbar.$$.fragment, local);
    			transition_out(alert.$$.fragment, local);
    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(navbar, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div16);
    			if_block.d();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].d();
    			}

    			if (detaching) detach_dev(t25);
    			destroy_component(alert, detaching);
    			if (detaching) detach_dev(t26);
    			destroy_component(footer, detaching);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('EditSchedule', slots, []);
    	let loading = false;
    	let status = -1;
    	let mssg = "";
    	let image = "https://www.lifewire.com/thmb/P856-0hi4lmA2xinYWyaEpRIckw=/1920x1326/filters:no_upscale():max_bytes(150000):strip_icc()/cloud-upload-a30f385a928e44e199a62210d578375a.jpg";
    	let schedule;
    	let user;
    	let types = ['Serviço', 'Produto'];

    	const unsubscribe = userStore.subscribe(data => {
    		console.log(data);
    		$$invalidate(4, schedule = data.schedule);
    		$$invalidate(5, user = data.user);

    		$$invalidate(3, image = schedule.image != "" || schedule.image != null
    		? schedule.image
    		: image);
    	});

    	const drop = async e => {
    		$$invalidate(0, loading = true);
    		const files = e.target.files;
    		const data = new FormData();
    		data.append("file", files[0]);
    		data.append("upload_preset", "vitrinedacasa");
    		const res = await fetch("https://api.cloudinary.com/v1_1/sankarkvs/image/upload", { method: "POST", body: data });
    		$$invalidate(0, loading = false);
    		const file = await res.json();
    		$$invalidate(4, schedule.image = file.secure_url, schedule);
    		$$invalidate(3, image = file.secure_url);
    	};

    	const dispatch = async e => {
    		e.preventDefault();
    		let res = await addschedule(schedule);
    		$$invalidate(1, status = res.status);
    		$$invalidate(2, mssg = res.mssg);
    		console.log(res);
    		document.location.href = "/dashboard";
    	};

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$2.warn(`<EditSchedule> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		schedule.url = this.value;
    		$$invalidate(4, schedule);
    		$$invalidate(6, types);
    	}

    	function input1_input_handler() {
    		schedule.title = this.value;
    		$$invalidate(4, schedule);
    		$$invalidate(6, types);
    	}

    	function input3_input_handler() {
    		schedule.description = this.value;
    		$$invalidate(4, schedule);
    		$$invalidate(6, types);
    	}

    	function input4_input_handler() {
    		schedule.price = this.value;
    		$$invalidate(4, schedule);
    		$$invalidate(6, types);
    	}

    	function select_change_handler() {
    		schedule.type = select_value(this);
    		$$invalidate(4, schedule);
    		$$invalidate(6, types);
    	}

    	$$self.$capture_state = () => ({
    		Alert,
    		addschedule,
    		userStore,
    		NavBar: Navbar,
    		Footer,
    		loading,
    		status,
    		mssg,
    		image,
    		schedule,
    		user,
    		types,
    		unsubscribe,
    		drop,
    		dispatch
    	});

    	$$self.$inject_state = $$props => {
    		if ('loading' in $$props) $$invalidate(0, loading = $$props.loading);
    		if ('status' in $$props) $$invalidate(1, status = $$props.status);
    		if ('mssg' in $$props) $$invalidate(2, mssg = $$props.mssg);
    		if ('image' in $$props) $$invalidate(3, image = $$props.image);
    		if ('schedule' in $$props) $$invalidate(4, schedule = $$props.schedule);
    		if ('user' in $$props) $$invalidate(5, user = $$props.user);
    		if ('types' in $$props) $$invalidate(6, types = $$props.types);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		loading,
    		status,
    		mssg,
    		image,
    		schedule,
    		user,
    		types,
    		drop,
    		dispatch,
    		input0_input_handler,
    		input1_input_handler,
    		input3_input_handler,
    		input4_input_handler,
    		select_change_handler
    	];
    }

    class EditSchedule extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "EditSchedule",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    /* src\components\Card.svelte generated by Svelte v3.47.0 */

    const { Object: Object_1$1, console: console_1$1 } = globals;
    const file$4 = "src\\components\\Card.svelte";

    // (27:4) {#if link.image !== null && link.image !== ""}
    function create_if_block$1(ctx) {
    	let img;
    	let img_src_value;

    	const block = {
    		c: function create() {
    			img = element("img");
    			this.h();
    		},
    		l: function claim(nodes) {
    			img = claim_element(nodes, "IMG", {
    				class: true,
    				style: true,
    				src: true,
    				alt: true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(img, "class", "card-img-top");
    			set_style(img, "max-height", "250px");
    			if (!src_url_equal(img.src, img_src_value = /*link*/ ctx[0].image)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", "Not available");
    			add_location(img, file$4, 27, 6, 756);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, img, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*link*/ 1 && !src_url_equal(img.src, img_src_value = /*link*/ ctx[0].image)) {
    				attr_dev(img, "src", img_src_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(img);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(27:4) {#if link.image !== null && link.image !== \\\"\\\"}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let div3;
    	let div2;
    	let t0;
    	let div0;
    	let h5;
    	let t1_value = /*link*/ ctx[0].title + "";
    	let t1;
    	let t2;
    	let hr;
    	let t3;
    	let div1;
    	let p;
    	let t4_value = /*link*/ ctx[0].description.substr(0, 100) + "..." + "";
    	let t4;
    	let t5;
    	let a;
    	let t6;
    	let a_href_value;
    	let mounted;
    	let dispose;
    	let if_block = /*link*/ ctx[0].image !== null && /*link*/ ctx[0].image !== "" && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			if (if_block) if_block.c();
    			t0 = space();
    			div0 = element("div");
    			h5 = element("h5");
    			t1 = text(t1_value);
    			t2 = space();
    			hr = element("hr");
    			t3 = space();
    			div1 = element("div");
    			p = element("p");
    			t4 = text(t4_value);
    			t5 = space();
    			a = element("a");
    			t6 = text("Entre");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { style: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			if (if_block) if_block.l(div2_nodes);
    			t0 = claim_space(div2_nodes);
    			div0 = claim_element(div2_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h5 = claim_element(div0_nodes, "H5", { class: true });
    			var h5_nodes = children(h5);
    			t1 = claim_text(h5_nodes, t1_value);
    			h5_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(div2_nodes);
    			hr = claim_element(div2_nodes, "HR", { class: true });
    			t3 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			p = claim_element(div1_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t4 = claim_text(p_nodes, t4_value);
    			p_nodes.forEach(detach_dev);
    			t5 = claim_space(div1_nodes);
    			a = claim_element(div1_nodes, "A", { href: true, target: true, class: true });
    			var a_nodes = children(a);
    			t6 = claim_text(a_nodes, "Entre");
    			a_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h5, "class", "card-title mb-0");
    			add_location(h5, file$4, 35, 6, 941);
    			attr_dev(div0, "class", "card-header");
    			add_location(div0, file$4, 34, 4, 908);
    			attr_dev(hr, "class", "mb-0");
    			add_location(hr, file$4, 37, 4, 1004);
    			attr_dev(p, "class", "card-text");
    			add_location(p, file$4, 39, 6, 1060);
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[0].url);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "class", "btn btn-primary svelte-leu1uk");
    			add_location(a, file$4, 42, 6, 1152);
    			attr_dev(div1, "class", "card-body");
    			add_location(div1, file$4, 38, 4, 1029);
    			attr_dev(div2, "class", "card sankarcard");
    			add_location(div2, file$4, 25, 2, 667);
    			attr_dev(div3, "style", /*cssVarStyles*/ ctx[1]);
    			add_location(div3, file$4, 24, 0, 635);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			if (if_block) if_block.m(div2, null);
    			append_hydration_dev(div2, t0);
    			append_hydration_dev(div2, div0);
    			append_hydration_dev(div0, h5);
    			append_hydration_dev(h5, t1);
    			append_hydration_dev(div2, t2);
    			append_hydration_dev(div2, hr);
    			append_hydration_dev(div2, t3);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, p);
    			append_hydration_dev(p, t4);
    			append_hydration_dev(div1, t5);
    			append_hydration_dev(div1, a);
    			append_hydration_dev(a, t6);

    			if (!mounted) {
    				dispose = listen_dev(a, "click", /*redirect*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*link*/ ctx[0].image !== null && /*link*/ ctx[0].image !== "") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(div2, t0);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*link*/ 1 && t1_value !== (t1_value = /*link*/ ctx[0].title + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*link*/ 1 && t4_value !== (t4_value = /*link*/ ctx[0].description.substr(0, 100) + "..." + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*link*/ 1 && a_href_value !== (a_href_value = /*link*/ ctx[0].url)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*cssVarStyles*/ 2) {
    				attr_dev(div3, "style", /*cssVarStyles*/ ctx[1]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let cssVarStyles;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Card', slots, []);
    	let { link } = $$props;
    	let { name } = $$props;
    	let { user } = $$props;

    	const redirect = async () => {
    		await axios.post("/api/user/clickadd", { instagram: name, _id: link._id }).then(res => console.log("done"));
    	};

    	let styles = {};

    	onMount(async () => {
    		$$invalidate(5, styles['primary_color'] = user.style.primary_color, styles);
    	});

    	const writable_props = ['link', 'name', 'user'];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1$1.warn(`<Card> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('link' in $$props) $$invalidate(0, link = $$props.link);
    		if ('name' in $$props) $$invalidate(3, name = $$props.name);
    		if ('user' in $$props) $$invalidate(4, user = $$props.user);
    	};

    	$$self.$capture_state = () => ({
    		link,
    		name,
    		user,
    		onMount,
    		axios,
    		redirect,
    		styles,
    		cssVarStyles
    	});

    	$$self.$inject_state = $$props => {
    		if ('link' in $$props) $$invalidate(0, link = $$props.link);
    		if ('name' in $$props) $$invalidate(3, name = $$props.name);
    		if ('user' in $$props) $$invalidate(4, user = $$props.user);
    		if ('styles' in $$props) $$invalidate(5, styles = $$props.styles);
    		if ('cssVarStyles' in $$props) $$invalidate(1, cssVarStyles = $$props.cssVarStyles);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*styles*/ 32) {
    			$$invalidate(1, cssVarStyles = Object.entries(styles).map(([key, value]) => `--${key}:${value}`).join(';'));
    		}
    	};

    	return [link, cssVarStyles, redirect, name, user, styles];
    }

    class Card extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, { link: 0, name: 3, user: 4 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Card",
    			options,
    			id: create_fragment$4.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*link*/ ctx[0] === undefined && !('link' in props)) {
    			console_1$1.warn("<Card> was created without expected prop 'link'");
    		}

    		if (/*name*/ ctx[3] === undefined && !('name' in props)) {
    			console_1$1.warn("<Card> was created without expected prop 'name'");
    		}

    		if (/*user*/ ctx[4] === undefined && !('user' in props)) {
    			console_1$1.warn("<Card> was created without expected prop 'user'");
    		}
    	}

    	get link() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set link(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get user() {
    		throw new Error("<Card>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set user(value) {
    		throw new Error("<Card>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\components\Loading.svelte generated by Svelte v3.47.0 */

    const file$3 = "src\\components\\Loading.svelte";

    function create_fragment$3(ctx) {
    	let div3;
    	let div0;
    	let t0;
    	let div1;
    	let t1;
    	let div2;
    	let t2;
    	let h1;
    	let t3;

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div0 = element("div");
    			t0 = space();
    			div1 = element("div");
    			t1 = space();
    			div2 = element("div");
    			t2 = space();
    			h1 = element("h1");
    			t3 = text("Wait for it...");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div0 = claim_element(div3_nodes, "DIV", { class: true });
    			children(div0).forEach(detach_dev);
    			t0 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			children(div1).forEach(detach_dev);
    			t1 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			children(div2).forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t2 = claim_space(nodes);
    			h1 = claim_element(nodes, "H1", { style: true });
    			var h1_nodes = children(h1);
    			t3 = claim_text(h1_nodes, "Wait for it...");
    			h1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "line svelte-1wgo5po");
    			add_location(div0, file$3, 1, 2, 24);
    			attr_dev(div1, "class", "line svelte-1wgo5po");
    			add_location(div1, file$3, 2, 2, 48);
    			attr_dev(div2, "class", "line svelte-1wgo5po");
    			add_location(div2, file$3, 3, 2, 72);
    			attr_dev(div3, "class", "load-1 svelte-1wgo5po");
    			add_location(div3, file$3, 0, 0, 0);
    			set_style(h1, "text-align", "center");
    			add_location(h1, file$3, 6, 0, 104);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div0);
    			append_hydration_dev(div3, t0);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div3, t1);
    			append_hydration_dev(div3, div2);
    			insert_hydration_dev(target, t2, anchor);
    			insert_hydration_dev(target, h1, anchor);
    			append_hydration_dev(h1, t3);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(h1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Loading', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Loading> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Loading extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Loading",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src\pages\Display.svelte generated by Svelte v3.47.0 */

    const { Object: Object_1, console: console_1 } = globals;
    const file$2 = "src\\pages\\Display.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i];
    	return child_ctx;
    }

    // (71:0) {:else}
    function create_else_block(ctx) {
    	let div1;
    	let div0;
    	let loading;
    	let current;
    	loading = new Loading({ $$inline: true });

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			create_component(loading.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { style: true });
    			var div0_nodes = children(div0);
    			claim_component(loading.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			set_style(div0, "margin-left", "50%");
    			set_style(div0, "margin-top", "50vh");
    			set_style(div0, "transform", "translate(-50%,-50%)");
    			add_location(div0, file$2, 72, 4, 2258);
    			attr_dev(div1, "class", "row");
    			add_location(div1, file$2, 71, 2, 2235);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			mount_component(loading, div0, null);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(loading.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(loading.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(loading);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(71:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (33:0) {#if user != null}
    function create_if_block(ctx) {
    	let div8;
    	let homenav;
    	let t0;
    	let div7;
    	let div5;
    	let div4;
    	let div0;
    	let h50;
    	let t1;
    	let t2;
    	let div3;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t3;
    	let h51;
    	let t4_value = /*user*/ ctx[1].instagram + "";
    	let t4;
    	let t5;
    	let div1;
    	let t6;
    	let t7_value = /*user*/ ctx[1].total_links + "";
    	let t7;
    	let t8;
    	let div2;
    	let a;
    	let span;
    	let t9;
    	let a_href_value;
    	let t10;
    	let div6;
    	let t11;
    	let footer;
    	let current;

    	homenav = new HomeNav({
    			props: { user: /*user*/ ctx[1] },
    			$$inline: true
    		});

    	let each_value = /*links*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	footer = new Footer({ $$inline: true });

    	const block = {
    		c: function create() {
    			div8 = element("div");
    			create_component(homenav.$$.fragment);
    			t0 = space();
    			div7 = element("div");
    			div5 = element("div");
    			div4 = element("div");
    			div0 = element("div");
    			h50 = element("h5");
    			t1 = text("Seja bem vindo");
    			t2 = space();
    			div3 = element("div");
    			img = element("img");
    			t3 = space();
    			h51 = element("h5");
    			t4 = text(t4_value);
    			t5 = space();
    			div1 = element("div");
    			t6 = text("Opções : ");
    			t7 = text(t7_value);
    			t8 = space();
    			div2 = element("div");
    			a = element("a");
    			span = element("span");
    			t9 = text("Instagram");
    			t10 = space();
    			div6 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t11 = space();
    			create_component(footer.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div8 = claim_element(nodes, "DIV", { class: true, style: true });
    			var div8_nodes = children(div8);
    			claim_component(homenav.$$.fragment, div8_nodes);
    			t0 = claim_space(div8_nodes);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div5 = claim_element(div7_nodes, "DIV", { class: true, style: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true, style: true });
    			var div4_nodes = children(div4);
    			div0 = claim_element(div4_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h50 = claim_element(div0_nodes, "H5", { class: true });
    			var h50_nodes = children(h50);
    			t1 = claim_text(h50_nodes, "Seja bem vindo");
    			h50_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);

    			img = claim_element(div3_nodes, "IMG", {
    				src: true,
    				alt: true,
    				class: true,
    				width: true,
    				height: true
    			});

    			t3 = claim_space(div3_nodes);
    			h51 = claim_element(div3_nodes, "H5", { class: true });
    			var h51_nodes = children(h51);
    			t4 = claim_text(h51_nodes, t4_value);
    			h51_nodes.forEach(detach_dev);
    			t5 = claim_space(div3_nodes);
    			div1 = claim_element(div3_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t6 = claim_text(div1_nodes, "Opções : ");
    			t7 = claim_text(div1_nodes, t7_value);
    			div1_nodes.forEach(detach_dev);
    			t8 = claim_space(div3_nodes);
    			div2 = claim_element(div3_nodes, "DIV", {});
    			var div2_nodes = children(div2);
    			a = claim_element(div2_nodes, "A", { class: true, href: true });
    			var a_nodes = children(a);
    			span = claim_element(a_nodes, "SPAN", { "data-feather": true });
    			children(span).forEach(detach_dev);
    			t9 = claim_text(a_nodes, "Instagram");
    			a_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t10 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true, style: true });
    			var div6_nodes = children(div6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div6_nodes);
    			}

    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			t11 = claim_space(div8_nodes);
    			claim_component(footer.$$.fragment, div8_nodes);
    			div8_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h50, "class", "card-title mb-0");
    			add_location(h50, file$2, 39, 12, 1255);
    			attr_dev(div0, "class", "card-header");
    			add_location(div0, file$2, 38, 10, 1216);
    			if (!src_url_equal(img.src, img_src_value = /*user*/ ctx[1].dp)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*user*/ ctx[1].instagram);
    			attr_dev(img, "class", "img-fluid rounded-circle mb-2");
    			attr_dev(img, "width", "128");
    			attr_dev(img, "height", "128");
    			add_location(img, file$2, 42, 12, 1381);
    			attr_dev(h51, "class", "card-title mb-0");
    			add_location(h51, file$2, 49, 12, 1588);
    			attr_dev(div1, "class", "text-muted mb-2");
    			add_location(div1, file$2, 50, 12, 1651);
    			attr_dev(span, "data-feather", "instagram");
    			add_location(span, file$2, 56, 17, 1894);
    			attr_dev(a, "class", "btn btn-danger btn-sm svelte-3tr2qt");
    			attr_dev(a, "href", a_href_value = "https://www.instagram.com/" + /*user*/ ctx[1].instagram + "/");
    			add_location(a, file$2, 53, 14, 1750);
    			add_location(div2, file$2, 52, 12, 1729);
    			attr_dev(div3, "class", "card-body text-center");
    			add_location(div3, file$2, 41, 10, 1332);
    			attr_dev(div4, "class", "card mb-2");
    			set_style(div4, "min-width", "300px");
    			add_location(div4, file$2, 37, 8, 1157);
    			attr_dev(div5, "class", "row");
    			set_style(div5, "justify-content", "center");
    			add_location(div5, file$2, 36, 6, 1099);
    			attr_dev(div6, "class", "row");
    			set_style(div6, "justify-content", "center");
    			add_location(div6, file$2, 62, 6, 2032);
    			attr_dev(div7, "class", "content");
    			add_location(div7, file$2, 35, 4, 1070);
    			attr_dev(div8, "class", "main");
    			attr_dev(div8, "style", /*cssVarStyles*/ ctx[3]);
    			add_location(div8, file$2, 33, 2, 999);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div8, anchor);
    			mount_component(homenav, div8, null);
    			append_hydration_dev(div8, t0);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, div0);
    			append_hydration_dev(div0, h50);
    			append_hydration_dev(h50, t1);
    			append_hydration_dev(div4, t2);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, img);
    			append_hydration_dev(div3, t3);
    			append_hydration_dev(div3, h51);
    			append_hydration_dev(h51, t4);
    			append_hydration_dev(div3, t5);
    			append_hydration_dev(div3, div1);
    			append_hydration_dev(div1, t6);
    			append_hydration_dev(div1, t7);
    			append_hydration_dev(div3, t8);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, a);
    			append_hydration_dev(a, span);
    			append_hydration_dev(a, t9);
    			append_hydration_dev(div7, t10);
    			append_hydration_dev(div7, div6);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div6, null);
    			}

    			append_hydration_dev(div8, t11);
    			mount_component(footer, div8, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const homenav_changes = {};
    			if (dirty & /*user*/ 2) homenav_changes.user = /*user*/ ctx[1];
    			homenav.$set(homenav_changes);

    			if (!current || dirty & /*user*/ 2 && !src_url_equal(img.src, img_src_value = /*user*/ ctx[1].dp)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (!current || dirty & /*user*/ 2 && img_alt_value !== (img_alt_value = /*user*/ ctx[1].instagram)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if ((!current || dirty & /*user*/ 2) && t4_value !== (t4_value = /*user*/ ctx[1].instagram + "")) set_data_dev(t4, t4_value);
    			if ((!current || dirty & /*user*/ 2) && t7_value !== (t7_value = /*user*/ ctx[1].total_links + "")) set_data_dev(t7, t7_value);

    			if (!current || dirty & /*user*/ 2 && a_href_value !== (a_href_value = "https://www.instagram.com/" + /*user*/ ctx[1].instagram + "/")) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*links, name, user*/ 7) {
    				each_value = /*links*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div6, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*cssVarStyles*/ 8) {
    				attr_dev(div8, "style", /*cssVarStyles*/ ctx[3]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(homenav.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(footer.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(homenav.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(footer.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div8);
    			destroy_component(homenav);
    			destroy_each(each_blocks, detaching);
    			destroy_component(footer);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(33:0) {#if user != null}",
    		ctx
    	});

    	return block;
    }

    // (64:8) {#each links as link}
    function create_each_block(ctx) {
    	let card;
    	let current;

    	card = new Card({
    			props: {
    				link: /*link*/ ctx[5],
    				name: /*name*/ ctx[0],
    				user: /*user*/ ctx[1]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(card.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(card.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(card, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const card_changes = {};
    			if (dirty & /*links*/ 4) card_changes.link = /*link*/ ctx[5];
    			if (dirty & /*name*/ 1) card_changes.name = /*name*/ ctx[0];
    			if (dirty & /*user*/ 2) card_changes.user = /*user*/ ctx[1];
    			card.$set(card_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(card.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(card.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(card, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(64:8) {#each links as link}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*user*/ ctx[1] != null) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let cssVarStyles;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Display', slots, []);
    	let { name } = $$props;
    	let user;
    	let links = [];
    	let styles = {};

    	onMount(async () => {
    		console.log(name);
    		$$invalidate(1, user = await displayuser(name));
    		if (user === null) document.location.href = "notfound";
    		$$invalidate(2, links = user.links);
    		$$invalidate(4, styles['warning_color'] = user.style.warning_color, styles);
    		axios.post("/api/user/viewadd", { instagram: name }).then(res => console.log("Done"));
    	});

    	const writable_props = ['name'];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<Display> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    	};

    	$$self.$capture_state = () => ({
    		Card,
    		HomeNav,
    		Footer,
    		onMount,
    		displayuser,
    		Loading,
    		axios,
    		name,
    		user,
    		links,
    		styles,
    		cssVarStyles
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('user' in $$props) $$invalidate(1, user = $$props.user);
    		if ('links' in $$props) $$invalidate(2, links = $$props.links);
    		if ('styles' in $$props) $$invalidate(4, styles = $$props.styles);
    		if ('cssVarStyles' in $$props) $$invalidate(3, cssVarStyles = $$props.cssVarStyles);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*styles*/ 16) {
    			$$invalidate(3, cssVarStyles = Object.entries(styles).map(([key, value]) => `--${key}:${value}`).join(';'));
    		}
    	};

    	return [name, user, links, cssVarStyles, styles];
    }

    class Display extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { name: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Display",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*name*/ ctx[0] === undefined && !('name' in props)) {
    			console_1.warn("<Display> was created without expected prop 'name'");
    		}
    	}

    	get name() {
    		throw new Error("<Display>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Display>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\pages\Page404.svelte generated by Svelte v3.47.0 */

    const file$1 = "src\\pages\\Page404.svelte";

    function create_fragment$1(ctx) {
    	let div5;
    	let main;
    	let div4;
    	let div3;
    	let div2;
    	let div1;
    	let div0;
    	let h1;
    	let t0;
    	let t1;
    	let p0;
    	let t2;
    	let t3;
    	let p1;
    	let t4;
    	let t5;
    	let a;
    	let t6;

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			main = element("main");
    			div4 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			h1 = element("h1");
    			t0 = text("404");
    			t1 = space();
    			p0 = element("p");
    			t2 = text("Página não encontrada.");
    			t3 = space();
    			p1 = element("p");
    			t4 = text("A página que você está procurando pode ter sido removida.");
    			t5 = space();
    			a = element("a");
    			t6 = text("Voltar para o Início");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			main = claim_element(div5_nodes, "MAIN", { class: true });
    			var main_nodes = children(main);
    			div4 = claim_element(main_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h1 = claim_element(div0_nodes, "H1", { class: true });
    			var h1_nodes = children(h1);
    			t0 = claim_text(h1_nodes, "404");
    			h1_nodes.forEach(detach_dev);
    			t1 = claim_space(div0_nodes);
    			p0 = claim_element(div0_nodes, "P", { class: true });
    			var p0_nodes = children(p0);
    			t2 = claim_text(p0_nodes, "Página não encontrada.");
    			p0_nodes.forEach(detach_dev);
    			t3 = claim_space(div0_nodes);
    			p1 = claim_element(div0_nodes, "P", { class: true });
    			var p1_nodes = children(p1);
    			t4 = claim_text(p1_nodes, "A página que você está procurando pode ter sido removida.");
    			p1_nodes.forEach(detach_dev);
    			t5 = claim_space(div0_nodes);
    			a = claim_element(div0_nodes, "A", { href: true, class: true });
    			var a_nodes = children(a);
    			t6 = claim_text(a_nodes, "Voltar para o Início");
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			main_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h1, "class", "display-1 font-weight-bold");
    			add_location(h1, file$1, 7, 14, 349);
    			attr_dev(p0, "class", "h1");
    			add_location(p0, file$1, 8, 14, 412);
    			attr_dev(p1, "class", "h2 font-weight-normal mt-3 mb-4");
    			add_location(p1, file$1, 9, 14, 468);
    			attr_dev(a, "href", "/");
    			attr_dev(a, "class", "btn btn-primary btn-lg");
    			add_location(a, file$1, 12, 14, 623);
    			attr_dev(div0, "class", "text-center");
    			add_location(div0, file$1, 6, 12, 308);
    			attr_dev(div1, "class", "d-table-cell align-middle");
    			add_location(div1, file$1, 5, 10, 255);
    			attr_dev(div2, "class", "col-sm-10 col-md-8 col-lg-6 mx-auto d-table h-100");
    			add_location(div2, file$1, 4, 8, 180);
    			attr_dev(div3, "class", "row h-100");
    			add_location(div3, file$1, 3, 6, 147);
    			attr_dev(div4, "class", "container d-flex flex-column");
    			add_location(div4, file$1, 2, 4, 97);
    			attr_dev(main, "class", "content d-flex p-0");
    			add_location(main, file$1, 1, 2, 58);
    			attr_dev(div5, "class", "main d-flex justify-content-center w-100");
    			add_location(div5, file$1, 0, 0, 0);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, main);
    			append_hydration_dev(main, div4);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, h1);
    			append_hydration_dev(h1, t0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, p0);
    			append_hydration_dev(p0, t2);
    			append_hydration_dev(div0, t3);
    			append_hydration_dev(div0, p1);
    			append_hydration_dev(p1, t4);
    			append_hydration_dev(div0, t5);
    			append_hydration_dev(div0, a);
    			append_hydration_dev(a, t6);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Page404', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Page404> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Page404 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Page404",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src\App.svelte generated by Svelte v3.47.0 */
    const file = "src\\App.svelte";

    // (19:4) <Route path="/">
    function create_default_slot_2(ctx) {
    	let home;
    	let current;
    	home = new Home({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(home.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(home.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(home, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(home.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(home.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(home, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(19:4) <Route path=\\\"/\\\">",
    		ctx
    	});

    	return block;
    }

    // (29:4) <Route path="/:name" let:params>
    function create_default_slot_1(ctx) {
    	let display;
    	let current;

    	display = new Display({
    			props: { name: /*params*/ ctx[1].name },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(display.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(display.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(display, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const display_changes = {};
    			if (dirty & /*params*/ 2) display_changes.name = /*params*/ ctx[1].name;
    			display.$set(display_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(display.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(display.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(display, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(29:4) <Route path=\\\"/:name\\\" let:params>",
    		ctx
    	});

    	return block;
    }

    // (17:0) <Router {url}>
    function create_default_slot(ctx) {
    	let div;
    	let route0;
    	let t0;
    	let route1;
    	let t1;
    	let route2;
    	let t2;
    	let route3;
    	let t3;
    	let route4;
    	let t4;
    	let route5;
    	let t5;
    	let route6;
    	let t6;
    	let route7;
    	let t7;
    	let route8;
    	let t8;
    	let route9;
    	let t9;
    	let route10;
    	let t10;
    	let route11;
    	let current;

    	route0 = new Route({
    			props: {
    				path: "/",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route1 = new Route({
    			props: { path: "/login", component: Login },
    			$$inline: true
    		});

    	route2 = new Route({
    			props: { path: "/register", component: Register },
    			$$inline: true
    		});

    	route3 = new Route({
    			props: {
    				path: "/resetpassword",
    				component: ResetPassword
    			},
    			$$inline: true
    		});

    	route4 = new Route({
    			props: { path: "/dashboard", component: Dashboard },
    			$$inline: true
    		});

    	route5 = new Route({
    			props: { path: "/addlink", component: AddLink },
    			$$inline: true
    		});

    	route6 = new Route({
    			props: { path: "/editlink", component: EditLink },
    			$$inline: true
    		});

    	route7 = new Route({
    			props: {
    				path: "/addschedule",
    				component: AddSchedule
    			},
    			$$inline: true
    		});

    	route8 = new Route({
    			props: {
    				path: "/editschedule",
    				component: EditSchedule
    			},
    			$$inline: true
    		});

    	route9 = new Route({
    			props: { path: "/notfound", component: Page404 },
    			$$inline: true
    		});

    	route10 = new Route({
    			props: {
    				path: "/:name",
    				$$slots: {
    					default: [
    						create_default_slot_1,
    						({ params }) => ({ 1: params }),
    						({ params }) => params ? 2 : 0
    					]
    				},
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	route11 = new Route({
    			props: { path: "*", component: Page404 },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			create_component(route0.$$.fragment);
    			t0 = space();
    			create_component(route1.$$.fragment);
    			t1 = space();
    			create_component(route2.$$.fragment);
    			t2 = space();
    			create_component(route3.$$.fragment);
    			t3 = space();
    			create_component(route4.$$.fragment);
    			t4 = space();
    			create_component(route5.$$.fragment);
    			t5 = space();
    			create_component(route6.$$.fragment);
    			t6 = space();
    			create_component(route7.$$.fragment);
    			t7 = space();
    			create_component(route8.$$.fragment);
    			t8 = space();
    			create_component(route9.$$.fragment);
    			t9 = space();
    			create_component(route10.$$.fragment);
    			t10 = space();
    			create_component(route11.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", {});
    			var div_nodes = children(div);
    			claim_component(route0.$$.fragment, div_nodes);
    			t0 = claim_space(div_nodes);
    			claim_component(route1.$$.fragment, div_nodes);
    			t1 = claim_space(div_nodes);
    			claim_component(route2.$$.fragment, div_nodes);
    			t2 = claim_space(div_nodes);
    			claim_component(route3.$$.fragment, div_nodes);
    			t3 = claim_space(div_nodes);
    			claim_component(route4.$$.fragment, div_nodes);
    			t4 = claim_space(div_nodes);
    			claim_component(route5.$$.fragment, div_nodes);
    			t5 = claim_space(div_nodes);
    			claim_component(route6.$$.fragment, div_nodes);
    			t6 = claim_space(div_nodes);
    			claim_component(route7.$$.fragment, div_nodes);
    			t7 = claim_space(div_nodes);
    			claim_component(route8.$$.fragment, div_nodes);
    			t8 = claim_space(div_nodes);
    			claim_component(route9.$$.fragment, div_nodes);
    			t9 = claim_space(div_nodes);
    			claim_component(route10.$$.fragment, div_nodes);
    			t10 = claim_space(div_nodes);
    			claim_component(route11.$$.fragment, div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(div, file, 17, 2, 689);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			mount_component(route0, div, null);
    			append_hydration_dev(div, t0);
    			mount_component(route1, div, null);
    			append_hydration_dev(div, t1);
    			mount_component(route2, div, null);
    			append_hydration_dev(div, t2);
    			mount_component(route3, div, null);
    			append_hydration_dev(div, t3);
    			mount_component(route4, div, null);
    			append_hydration_dev(div, t4);
    			mount_component(route5, div, null);
    			append_hydration_dev(div, t5);
    			mount_component(route6, div, null);
    			append_hydration_dev(div, t6);
    			mount_component(route7, div, null);
    			append_hydration_dev(div, t7);
    			mount_component(route8, div, null);
    			append_hydration_dev(div, t8);
    			mount_component(route9, div, null);
    			append_hydration_dev(div, t9);
    			mount_component(route10, div, null);
    			append_hydration_dev(div, t10);
    			mount_component(route11, div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const route0_changes = {};

    			if (dirty & /*$$scope*/ 4) {
    				route0_changes.$$scope = { dirty, ctx };
    			}

    			route0.$set(route0_changes);
    			const route10_changes = {};

    			if (dirty & /*$$scope, params*/ 6) {
    				route10_changes.$$scope = { dirty, ctx };
    			}

    			route10.$set(route10_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(route0.$$.fragment, local);
    			transition_in(route1.$$.fragment, local);
    			transition_in(route2.$$.fragment, local);
    			transition_in(route3.$$.fragment, local);
    			transition_in(route4.$$.fragment, local);
    			transition_in(route5.$$.fragment, local);
    			transition_in(route6.$$.fragment, local);
    			transition_in(route7.$$.fragment, local);
    			transition_in(route8.$$.fragment, local);
    			transition_in(route9.$$.fragment, local);
    			transition_in(route10.$$.fragment, local);
    			transition_in(route11.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(route0.$$.fragment, local);
    			transition_out(route1.$$.fragment, local);
    			transition_out(route2.$$.fragment, local);
    			transition_out(route3.$$.fragment, local);
    			transition_out(route4.$$.fragment, local);
    			transition_out(route5.$$.fragment, local);
    			transition_out(route6.$$.fragment, local);
    			transition_out(route7.$$.fragment, local);
    			transition_out(route8.$$.fragment, local);
    			transition_out(route9.$$.fragment, local);
    			transition_out(route10.$$.fragment, local);
    			transition_out(route11.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(route0);
    			destroy_component(route1);
    			destroy_component(route2);
    			destroy_component(route3);
    			destroy_component(route4);
    			destroy_component(route5);
    			destroy_component(route6);
    			destroy_component(route7);
    			destroy_component(route8);
    			destroy_component(route9);
    			destroy_component(route10);
    			destroy_component(route11);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(17:0) <Router {url}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let router;
    	let current;

    	router = new Router({
    			props: {
    				url: /*url*/ ctx[0],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(router.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(router.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(router, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const router_changes = {};
    			if (dirty & /*url*/ 1) router_changes.url = /*url*/ ctx[0];

    			if (dirty & /*$$scope*/ 4) {
    				router_changes.$$scope = { dirty, ctx };
    			}

    			router.$set(router_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(router.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(router.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(router, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { url = "" } = $$props;
    	const writable_props = ['url'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	$$self.$capture_state = () => ({
    		Router,
    		Route,
    		Link,
    		Home,
    		Login,
    		Register,
    		ResetPassword,
    		Dashboard,
    		AddLink,
    		EditLink,
    		AddSchedule,
    		EditSchedule,
    		Display,
    		Page404,
    		url
    	});

    	$$self.$inject_state = $$props => {
    		if ('url' in $$props) $$invalidate(0, url = $$props.url);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [url];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { url: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get url() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set url(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const app = new App({
      target: document.body,
      hydrate: true,
    });

    return app;

})();
//# sourceMappingURL=bundle.js.map
