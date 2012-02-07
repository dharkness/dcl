(function(define){
	"use strict";
	define(["./dcl-mini"], function(dcl){

		function err(name, msg){
			throw Error("ERROR in class '" + name + "': " + msg);
		}

		function stubBeforeChain(chain){
			if(chain.length){
				return function(){
					for(var i = 0, l = chain.length; i < l; ++i){
						chain[i].apply(this, arguments);
					}
				};
			}
			return new Function;
		}

		var AdviceNode = dcl("dcl.AdviceNode", null, {
			constructor: function(){
				this.nb = this.pb = this.na = this.pa = this.nf = this.pf = this;
			},
			add: function(b, a, o, f){
				var t = new AdviceNode;
				t.p = this;
				t.b = b;
				t.a = a;
				t.o = o;
				t.f = f;
				this._add("b", t);
				this._add("a", t);
				this._add("f", t, o);
				if(o){ t.f = o(t.pf.f); }
				return t;
			},
			_add: function(topic, adviceNode, flag){
				if(adviceNode[topic] || flag){
					var n = "n" + topic, p = "p" + topic;
					(adviceNode[p] = this[p])[n] = (adviceNode[n] = this)[p] = adviceNode;
				}
			},
			remove: function(adviceNode){
				this._rem("b", adviceNode);
				this._rem("a", adviceNode);
				this._rem("f", adviceNode);
			},
			_rem: function(topic, adviceNode){
				var n = "n" + topic, p = "p" + topic;
				adviceNode[n][p] = adviceNode[p];
				adviceNode[p][n] = adviceNode[n];
			}
		});

		var Advice = dcl("dcl.Advice", dcl._Super, {
			constructor: function(){
				this.b = this.f.before;
				this.a = this.f.after;
				this.f = this.f.around;
			}
		});

		function stub(id, bases, name){
			var a = new AdviceNode, f, i = bases.length - 1;
			switch(id){
				case 1: f = stubBeforeChain(dcl._chain(bases, name)); break;
				case 2: f = dcl._stubAfterChain(dcl._chain(bases, name)); break;
				default: f = dcl._stubSuper(bases, name); break;
			}
			if(f){ a.add(0, 0, 0, f); }
			for(; i >= 0; --i){
				f = bases[i];
				if(f._meta){
					f = f._meta.hidden;
					if(f.hasOwnProperty(name)){
						f = f[name];
						if(f instanceof Advice){
							if(f.b || f.a){ a.add(f.b, f.a); }
						}
					}
				}
			}
			bases = null;
			if(a.pb === a && a.pa === a){
				// no before/after advices => fall back to a regular stub
				f = a.pf.f;
				a.remove(a);
				return f;
			}
			// AOP stub
			return makeAOPStub(a);
		}

		function makeAOPStub(a){
			var f = function(){
				var p, r;
				// running the before chain
				for(p = a.pb; p !== a; p = p.pb){
					p.b.apply(this, arguments);
				}
				// running the around chain
				try{
					if(a.pf !== a){ r = a.pf.f.apply(this, arguments); }
				}catch(e){
					r = e;
				}
				// running the after chain
				for(p = a.na; p !== a; p = p.na){
					p.a.call(this, r);
				}
				if(r instanceof Error){
					throw r;
				}
			};
			f.adviceNode = a;
			return f;
		}

		function mixChains(name, dst, src){
			var n, d, s;
			for(n in src){
				if(src.hasOwnProperty(n)){
					s = src[n];
					if(dst.hasOwnProperty(n)){
						d = dst[n];
						if(d !== 3){
							if(s === 3){
								continue;
							}
							if(d !== s){
								err(name, "member function '" + n + "' has incompatible chaining");
							}
						}
					}
					dst[n] = s;
				}
			}
		}

		function buildStubs(chains, bases, proto){
			for(var name in chains){
				proto[name] = stub(chains[name], bases, name);
			}
		}

		dcl._setStubs(mixChains, buildStubs);

		dcl.advise = function(f){ return new Advice(f); }

		function chain(id){
			return function(ctor, name){
				var m = ctor._meta;
				if(m){
					if(m.bases.length > 1){
						err(ctor.prototype.declaredClass, "chaining is being set on '" + name + "' for a class with non-null base");
					}
					m.chains[name] = id;
				}
			};
		}

		dcl.chainBefore = chain(1);
		dcl.chainAfter = chain(2);

		dcl.isInstanceOf = function(object, ctor){
			return object instanceof ctor || (object.constructor._meta && object.constructor._meta.bases.indexOf(ctor) >= 0);
		};

		dcl._AdviceNode = AdviceNode;
		dcl._makeAOPStub = makeAOPStub;

		return dcl;
	});
})(typeof define != "undefined" ? define : function(_, f){
	if(typeof module != "undefined"){
		module.exports = f(require("./dcl-mini"));
	}else{
		if(typeof dcl != "undefined"){
			dcl = f(dcl);  // describing a global
		}else{
			throw Error("Include dcl-mini.js before dcl.js");
		}
	}
});
