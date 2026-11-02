import{W as me,S as fe,P as ve,B as he,a as j,b as pe,V as ge,c as ye,C as k,A as oe,d as we,G as xe,N as Me,e as be}from"./three-BRAH9Aiv.js";import{aI as Pe,aJ as q}from"./index-DeQ-3j7b.js";import"./query-d9EJHOc_.js";import"./react-CPov65gV.js";import"./radix-BcVAIGPp.js";const ze=["volcano","core","research","content","websites","consulting","galaxy","ring","wave","globe","dna","saturn","logo"],Se=1.8,re=9,se=45,g=re*Math.tan(se/2*Math.PI/180),ie={volcano:{h:5.6,cy:.4},logo:{h:5,cy:0}},G=O=>ie[O]||ie.volcano,Ae=`
  attribute float aRand;
  attribute vec3 aTo;
  uniform float uProgress;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixel;
  uniform float uBurst;
  varying float vRand;
  varying float vDepth;
  void main() {
    float k = clamp((uProgress - aRand * 0.35) / 0.65, 0.0, 1.0);
    k = k * k * (3.0 - 2.0 * k);
    vec3 p = mix(position, aTo, k);
    float t = uTime * 0.6 + aRand * 20.0;
    p += vec3(sin(t), cos(t * 1.3), sin(t * 0.7)) * 0.025;
    p += normalize(p + vec3(0.0001)) * uBurst * (0.6 + aRand * 1.8) * 2.8;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = uSize * (0.55 + aRand * 0.9);
    gl_PointSize = s * uPixel * (10.0 / -mv.z);
    vRand = aRand;
    vDepth = clamp((-mv.z - 4.0) / 8.0, 0.0, 1.0);
  }
`,Re=`
  uniform vec3 uA;
  uniform vec3 uB;
  uniform vec3 uC;
  uniform vec3 uD;
  uniform float uOpacity;
  varying float vRand;
  varying float vDepth;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float glow = pow(1.0 - d * 2.0, 1.8);
    vec3 col = mix(uA, uB, smoothstep(0.0, 0.3, vRand));
    col = mix(col, uC, smoothstep(0.3, 0.62, vRand));
    col = mix(col, uD, smoothstep(0.62, 1.0, vRand));
    gl_FragColor = vec4(col, glow * uOpacity * (1.0 - vDepth * 0.6));
  }
`;function Oe(O,l){let P;try{P=new me({canvas:O,antialias:!1,alpha:!0,powerPreference:"high-performance"})}catch{return null}const T=window.matchMedia("(max-width: 960px)").matches;let f=T?4500:11e3;const N=Math.min(window.devicePixelRatio||1,T?1.25:1.75);P.setPixelRatio(N);const I=new fe,h=new ve(se,1,.1,100);h.position.set(0,0,re);const z={};ze.forEach((e,o)=>{z[e]=Pe(e,f,q(101+o*17))});const u=new Float32Array(f*3),ce=q(3);for(let e=0;e<u.length;e++)u[e]=(ce()-.5)*18;let E=z.volcano,S="volcano";const A=new Float32Array(E),p=new he,U=new j(u,3),X=new j(A,3);p.setAttribute("position",U),p.setAttribute("aTo",X);const _=new Float32Array(f),le=q(42);for(let e=0;e<f;e++)_[e]=le();p.setAttribute("aRand",new j(_,1)),p.boundingSphere=new pe(new ge,12);const y=T?3.4:3,r=new ye({vertexShader:Ae,fragmentShader:Re,transparent:!0,depthWrite:!1,blending:oe,uniforms:{uTime:{value:0},uProgress:{value:0},uSize:{value:y},uPixel:{value:N},uBurst:{value:0},uOpacity:{value:.9},uA:{value:new k("#feda75")},uB:{value:new k("#fa7e1e")},uC:{value:new k("#d62976")},uD:{value:new k("#962fbf")}}}),ue=new we(p,r),d=new xe;d.add(ue),I.add(d);let C=l.light,L=!1,H=1;function Y(e){C=e==="light",r.blending=C?Me:oe,H=C?1.2:1,r.needsUpdate=!0,l.reduced&&R()}Y(C?"light":"dark");const t={x:0,y:0,scale:1,opacity:0,spin:0,size:y},n={x:0,y:0,scale:1,opacity:.9,size:y},c={x:0,y:0,tx:0,ty:0};let m=null,J=2.2,w=1,x=1,V=null;function Z(){w=window.innerWidth,x=window.innerHeight,P.setSize(w,x,!1),h.aspect=w/x,h.updateProjectionMatrix(),V&&ee(V),l.reduced&&R()}Z();const K=new ResizeObserver(Z);K.observe(document.documentElement);const Q=e=>{c.tx=(e.clientX/w-.5)*2,c.ty=(e.clientY/x-.5)*2};window.addEventListener("pointermove",Q,{passive:!0});function $(e){const o=e.getBoundingClientRect();if(!o.width)return;const s=o.left+o.width/2,a=o.top+o.height/2,i=s/w*2-1,v=1-a/x*2,b=o.height*J/x*2*g/G(S).h;n.x=i*g*h.aspect,n.y=v*g-G(S).cy*b,n.scale=b,n.size=y*Math.max(.8,Math.min(1,b*1.8))}function ee(e){const o=w<760,s=e.anchor?.getBoundingClientRect();if(m=e.anchor&&s&&s.width>0&&s.height>0?e.anchor:null,J=e.anchorFit||2.2,m)return;const a=e.scale??1;if(o){const i=2*g*h.aspect*.92/5.4,v=Math.min(i,1.15);n.x=0,n.y=g*.12-G(S).cy*v,n.scale=v,n.size=y;return}if(e.corner==="end-bottom"){const i=document.documentElement.dir==="rtl";n.x=(i?-1:1)*(g*h.aspect-1.9*a),n.y=-g+2.2*a}else n.x=e.x??0,n.y=e.y??0;n.scale=a,n.size=y}function de(e){const o=r.uniforms.uProgress.value;for(let s=0,a=0;s<f;s++,a+=3){let i=Math.min(1,Math.max(0,(o-_[s]*.35)/.65));i=i*i*(3-2*i),u[a]+=(A[a]-u[a])*i,u[a+1]+=(A[a+1]-u[a+1])*i,u[a+2]+=(A[a+2]-u[a+2])*i}A.set(e),E=e,U.needsUpdate=!0,X.needsUpdate=!0,r.uniforms.uProgress.value=l.reduced?1:0}function R(){P.render(I,h)}const W=new be;let M=!l.reduced,F=0,B=0,te=0,ne=0;function D(e){if(!M)return;if(L&&e-ne<33){F=requestAnimationFrame(D);return}ne=e;const o=W.getDelta(),s=Math.min(o,.05);r.uniforms.uTime.value=W.elapsedTime,o>.024&&o<1?B+=o:B=Math.max(0,B-s),B>2&&(B=0,te<2&&(te++,f=Math.floor(f/2),p.setDrawRange(0,f),l.onSlow?.()));const a=r.uniforms.uBurst;a.value>.001?a.value*=Math.pow(.9,Math.min(o,.1)*60):a.value=0;const i=r.uniforms.uProgress;i.value<1&&(i.value=Math.min(1,i.value+Math.min(o,.25)/Se)),m&&$(m),c.x+=(c.tx-c.x)*.05,c.y+=(c.ty-c.y)*.05;const v=m?.18:.06;t.x+=(n.x-t.x)*v,t.y+=(n.y-t.y)*v,t.scale+=(n.scale-t.scale)*v,t.size+=(n.size-t.size)*.1,t.opacity+=(n.opacity*(L?.5:1)-t.opacity)*.06,t.spin+=s*.12,d.position.set(t.x,t.y,0),d.scale.setScalar(t.scale);const b=S==="logo";d.rotation.y=(b?Math.sin(t.spin*4)*.5:t.spin)+c.x*(m?.15:.35),d.rotation.x=(b?.06:.18)+c.y*(m?.08:.2),r.uniforms.uSize.value=t.size,r.uniforms.uOpacity.value=Math.min(1,t.opacity*H),R(),F=requestAnimationFrame(D)}M?F=requestAnimationFrame(D):(r.uniforms.uProgress.value=1,d.rotation.x=.18,R());const ae=()=>{const e=M;M=!document.hidden&&!l.reduced,M&&!e&&(W.getDelta(),F=requestAnimationFrame(D))};return document.addEventListener("visibilitychange",ae),{burst(){l.reduced||(r.uniforms.uBurst.value=1)},setTheme:Y,setDimmed(e){L=e},morph(e){z[e.shape]&&z[e.shape]!==E&&(de(z[e.shape]),S=e.shape),V=e,ee(e),n.opacity=e.opacity??.9,l.reduced&&(m&&$(m),Object.assign(t,n),d.position.set(t.x,t.y,0),d.scale.setScalar(t.scale),r.uniforms.uSize.value=t.size,r.uniforms.uOpacity.value=Math.min(1,t.opacity*H),r.uniforms.uProgress.value=1,R())},dispose(){M=!1,cancelAnimationFrame(F),K.disconnect(),window.removeEventListener("pointermove",Q),document.removeEventListener("visibilitychange",ae),p.dispose(),r.dispose(),P.dispose()}}}export{ze as SHAPES,Oe as createWorld};
