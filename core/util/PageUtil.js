var Q = require("q"), 
	PromiseUtil = require("./PromiseUtil");

var PageUtil = module.exports = {
	/**
	 * This method takes in anything returns from a Page.getElements call and returns the 
	 * elements in a standardized format: an array of EarlyPromises of ReactElements.
	 */
	standardizeElements(elements) {
		var result = elements;

		// the return value could be a single element or an array. first, let's
		// make sure that it's an array.
		result = PageUtil.makeArray(result);

		// next, ensure that all elements are EarlyPromises.
		result = result.map((element) => {
			return PromiseUtil.early(Q(element));
		});

		return result;
	},

	standardizeMetaTags(metaTags) {
		var returnValue = {}
		Object.keys(metaTags).forEach((key) => {
			returnValue[key] = Q(metaTags[key]);
		});

		return returnValue;
	},

	/**
	 * Given an array of page instances, return an object that implements the page interface. This returned object's
	 * methods delegate to the first page in the pages array, passing the second page's implementation as the next
	 * variable (and the second page's implementation gets the third page's next, and so on). 
	 */
	createPageChain(pages) {

		return {
			handleRoute: PageUtil.createObjectFunctionChain(pages, "handleRoute", 2, () => ({code:200}), Q),
			getTitle: PageUtil.createObjectFunctionChain(pages, "getTitle", 0, () => "", Q), 
			getHeadScriptFiles: PageUtil.createObjectFunctionChain(pages, "getHeadScriptFiles", 0, () => [], PageUtil.makeArray),
			getSystemScriptFiles: PageUtil.createObjectFunctionChain(pages, "getSystemScriptFiles", 0, () => [], PageUtil.makeArray),
			getHeadStylesheets: PageUtil.createObjectFunctionChain(pages, "getHeadStylesheets", 0, () => [], PageUtil.makeArray),
			getMetaTags: PageUtil.createObjectFunctionChain(pages, "getMetaTags", 0, () =>  ({"Content-Type": "text/html; charset=utf-8"}), PageUtil.standardizeMetaTags),
			getCanonicalUrl: PageUtil.createObjectFunctionChain(pages, "getCanonicalUrl", 0, () => "", Q),
			getElements: PageUtil.createObjectFunctionChain(pages, "getElements", 0, () => [], PageUtil.standardizeElements)

		}
	},

	/**
	 * Given an array of objects and a function name, this returns a function that will call functionName on the first
	 * object, adding a next parameter to the end that is a function to call to the next object's implementation of functionName, and so on
	 * down the line. It is a way to make a middleware-like chain of functions, but the functions will be bound to the object in 
	 * question from objects.
	 * 
	 * The last object in the array will also receive a next parameter, which will call defaultImpl.
	 * 
	 * standardizeReturnValue will be called on every return value from functionName so that next will always return the same type. This
	 * is useful when a function can return one of many different types.
	 */
	createObjectFunctionChain(objects, functionName, argumentCount, defaultImpl, standardizeReturnValue) {
		// our first order of business is to get an array of pure functions to chain; this involves finding
		// which objects have implementations for functionName, binding those implementations to the object
		// in question, and standardizing the return values.
		var functionsToChain = [];
		objects.forEach((object) => {
			if (object[functionName]) {
				functionsToChain.push(() => standardizeReturnValue(object[functionName].apply(object, arguments)));
			}
		});
		// the innermost implementation calls the default implementation and standardizes the result.
		functionsToChain.push(() => standardizeReturnValue(defaultImpl.apply(null, arguments)));

		// now we have an array of pure functions to chain.
		return PageUtil.createFunctionChain(functionsToChain, argumentCount);
	},

	createFunctionChain(functions, argumentCount) {
		if (functions.length === 0 ) {
			throw new Error("createFunctionChain cannot be called with zero-length array.");
		}

		// we start from the innermost implementation (i.e. the last in the array) and move outward. nextImpl holds 
		// the function that will be used as the next argument for the function before it in the array.
		var nextImpl = functions[functions.length - 1];
		// now let's chain together the other implementations.
		for (var i = functions.length - 2; i >= 0; i--) {
			// 
			nextImpl = PageUtil._addArgumentToFunction(functions[i], nextImpl, argumentCount);
		}
		return nextImpl;
	},

	// takes in a function fn and returns a function that calls fn with argument bound at the end of the argument list.
	_addArgumentToFunction(fn, argument, argumentCount) {
		if (argumentCount > 6) {
			throw new Error("_addArgumentToFunction only supports methods with up to 6 arguments");
		}
		return function(a, b, c, d, e, f) {
			var args = [a, b, c, d, e, f];
			args = args.slice(0, argumentCount);
			args.push(argument);
			return fn.apply(null, args);
		}
	},

	makeArray(valueOrArray) {
		if (!Array.isArray(valueOrArray)) {
			return [valueOrArray];
		}
		return valueOrArray;
	}
}