import { noop, get, returnFalse } from 'react-core/util';
import { Renderer } from 'react-core/createRenderer';
import { NOWORK, CAPTURE, DETACH } from './effectTag';
import { effects } from './util';

export function pushError(fiber, hook, error) {
	let names = [];

	let boundary = findCatchComponent(fiber, names);
	let stack = describeError(names, hook);
	if (boundary) {
		fiber.effectTag = NOWORK;
		boundary._children = boundary.child = null;
		boundary.effectTag *= CAPTURE;
		boundary.errorInfo = [error, { ownerStack: stack }];
		Renderer.catchBoundary = boundary;
		// console.log('捕捉到错误的组件', boundary.name);
	} else {
		var p = fiber.return;
		for (var i in p._children) {
			if (p._children[i] == fiber) {
				fiber.type = noop;
			}
		}
		while (p) {
			p._hydrating = false;
			p = p.return;
		}
		// 如果同时发生多个错误，那么只收集第一个错误，并延迟到afterPatch后执行
		if (!Renderer.catchError) {
			Renderer.catchError = error;
		}
	}
}

export function guardCallback(host, hook, args, throwIt) {
	try {
		let fn = host[hook];
		if (hook == 'componentWillUnmount') {
			host[hook] = noop;
		}
		if (fn) {
			return fn.apply(host, args);
		}
		return true;
	} catch (error) {
		pushError(get(host), hook, error);
		if (throwIt) {
			throw error;
		}
	}
}

function describeError(names, hook) {
	let segments = [`**${hook}** method occur error `];
	names.forEach(function(name, i) {
		if (names[i + 1]) {
			segments.push('in ' + name + ' (created By ' + names[i + 1] + ')');
		}
	});
	return segments.join('\n').trim();
}

/**
 * 此方法遍历医生节点中所有updater，收集沿途的标签名与组件名
 */
function findCatchComponent(topFiber, names) {
	let instance,
		name,
		fiber = topFiber;
	if (!topFiber) {
		return;
	}
	while (fiber.return) {
		name = fiber.name;
		if (fiber.tag < 4) {
			names.push(name);
			instance = fiber.stateNode || {};
			if (instance.componentDidCatch) {
				if (fiber._isDoctor) {
					var updater = instance.updater;
					fiber.effectTag = NOWORK;
					updater.enqueueSetState = returnFalse;
					guardCallback(instance, 'componentWillUnmount', []);
					updater.isMounted = returnFalse;
				} else if (fiber !== topFiber) {
					return fiber;
				}
			}
		} else if (fiber.tag === 5) {
			names.push(name);
		}
		fiber = fiber.return;
	}
}
