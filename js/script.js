var freq = {
	MAX_SAMPLES: 1000,
	MAX_TRAJECTORY: 1000,
	MAX_SPLINE: 1000,
	SPLINE_SAMPLES: 8,
};

freq.posToComplex = function(x, y) {
	return math.complex(x*2 - 1, y*2 - 1);
};

function relMouseCoords(event, element){
	// Source: http://stackoverflow.com/a/5932203
    var totalOffsetX = 0;
    var totalOffsetY = 0;
    var canvasX = 0;
    var canvasY = 0;
    var currentElement = element;

    do{
        totalOffsetX += currentElement.offsetLeft - currentElement.scrollLeft;
        totalOffsetY += currentElement.offsetTop - currentElement.scrollTop;
    }
    while(currentElement = currentElement.offsetParent)

    canvasX = event.pageX - totalOffsetX;
    canvasY = event.pageY - totalOffsetY;

    return {x:canvasX/element.clientHeight, y:canvasY/element.clientWidth}
}

$(function() {
	$("#slider").slider({
		change: function(event, ui) { 
			$("#nlabel").text("N = " + $(this).slider('option', 'value').toString());
			
		} 
	});
	
	freq.scene = new freq.Scene();
	var isDragging = false;
	var lastMousePos = {x: 0, y: 0};
	
	$("canvas")
	.mousedown(function(e) {
		isDragging = true;
		lastMousePos = {x: e.pageX, y: e.pageY};
		e.preventDefault();
	})
	.mouseup(function(e) {
		isDragging = false;
		e.preventDefault();
	})
	.mousemove(function(e) {
		if (isDragging && event.which == 2) {
			var temp = lastMousePos;
			lastMousePos = {x: e.pageX, y: e.pageY};
			var diff = new THREE.Vector2(lastMousePos.x - temp.x, lastMousePos.y - temp.y);
			freq.scene.mouseMoved(diff);
		}
		e.preventDefault();
	})
	.click(function(e) {
		switch(e.which) {
			case 1:
				var xy = relMouseCoords(e, e.target);
				var point = freq.posToComplex(xy.x, xy.y);
				freq.scene.addPoint(point);
				$("#nlabel").text("N = " + freq.scene.getN().toString());
				$("#slider").slider('value', freq.scene.getN());
				$("#slider").slider("option", "max", freq.scene.nums.length * freq.SPLINE_SAMPLES);
				break;
			}
		e.preventDefault();
	})
	
	$("#start").click(function() {
		freq.scene.start();
	});
	
	$("#clear").click(function() {
		freq.scene.clear();
	});
	
	$('#splineOn').change(function() {
		freq.scene.splineObj.visible = $(this).is(':checked');
	});
	
	document.addEventListener('touchstart', function(e) {
		if (e.touches.length < 2) {
			//e.preventDefault();
			var touch = e.touches[0];
			isDragging = true;
			lastMousePos = {x: touch.pageX, y: touch.pageY};
		}
	});
	document.addEventListener('touchend', function(e) {
		isDragging = false;
	});
	document.addEventListener('touchmove', function(e) {
		if (isDragging && e.touches.length < 2) {
			var touch = e.touches[0];
			var temp = lastMousePos;
			lastMousePos = {x: touch.pageX, y: touch.pageY};
			var diff = new THREE.Vector2(lastMousePos.x - temp.x, lastMousePos.y - temp.y);
			freq.scene.mouseMoved(diff);
		}
	});
	freq.scene.addPoint(math.complex(0,0.5));
	
	freq.scene.render();
	
});

freq.Phasor = function(r, pos, phase, freq) {
	this.r = r;
	this.pos = pos;
	this.phase = phase;
	this.freq = freq;
	this.circle;
	
	this.initCircle();
};

freq.Phasor.prototype = {
	getVec: function() {
		var e = math.exp(math.multiply(math.i, this.phase) );
		var num = math.multiply(this.r, e);
		return new THREE.Vector3(math.re(num) + this.pos.x, math.im(num) + this.pos.y, this.circle.position.z);
	},
	
	step: function(t) {
		var incr = t * this.freq * 2 * math.pi;
		this.phase += incr;
		this.circle.rotateOnAxis(new THREE.Vector3(0, 0, 1), incr);
		//this.circle.position.z += t;
	},
	
	getT: function() {
		return 1 / this.freq;
	},
	
	initCircle: function() {
		var segments = 64,
		material = new THREE.LineBasicMaterial( { color: 0x0000ff } ),
		geometry = new THREE.CircleGeometry( this.r, segments );
		
		this.circle = new THREE.Line( geometry, material );
		this.circle.position.copy(this.pos);
		this.circle.rotateOnAxis(new THREE.Vector3(0, 0, 1), this.phase);
	},
	
	setPos: function(pos) {
		this.pos = pos;
		this.circle.position.copy(this.pos);
	},
};
		
freq.Scene = function() {
	'use strict';
	this.axes;
	this.phasors = [];
	this.points;
	this.spline;
	this.splineObj;
	this.trajectory;
	this.trajectoryInterval;
	this.nums = [];
	this.nextPoint;
	this.isDrawing = false;
	this.hasStarted = false;
	this.t = 0;
	this.tStep = 0.1;
	this.timeSinceLastTrajectory;
	this.trajectoryIndex;
	this.timeStamp;
	this.mousedown;
	this.period;
	this.formula = "";
	
	this.bugFix = false;

	this.camera = new THREE.OrthographicCamera( -1, 1, -1, 1, 0.1, 1000 );
	this.cameraPos = math.complex(0, 1);
	//this.camera.lookAt(new THREE.Vector3(0, 0, -1));

	this.renderer = new THREE.WebGLRenderer({alpha: true});
	//this.renderer.setClearColor(0xffffff, 1);
	var size = math.min(window.innerWidth/2, window.innerHeight/2);
	this.renderer.setSize( size, size );
	$("#scene").append( this.renderer.domElement );

	this.camera.position.z = 5;
	
	this.init();
	this.initPoints();
	this.initSpline();


};



freq.Scene.prototype = {
	init: function() {
		this.t = 0;
		this.isDrawing = false;
		this.phasors = [];
		
		
		this.scene = new THREE.Scene();
	
		this.initAxes();
		this.updateTimeStamp();
	},
	
	clear: function() {
		this.initPoints();
		this.initSpline();
		this.bugFix = false;
		this.addPoint(math.complex(0,0));
		this.nums = [];
		this.init();
		this.scene.add(this.splineObj);
		if (!$("#splineOn").is(":checked")) {
			this.splineObj.visible = false;
		}
		this.scene.add(this.points);
	},

	render: function render() {
		if (this.hasStarted) {
			timeDiff = this.getTimeDiff(this.updateTimeStamp());
			this.step(timeDiff / 100000);
		}
		
		requestAnimationFrame( render.bind(this) );
		this.renderer.render( this.scene, this.camera );
	},
	
	initPoints: function() {
		var material = new THREE.PointCloudMaterial({
			color: 0x00ff00, 
			size: 5,
			sizeAttenuation: false,
		});
		var geom = new THREE.Geometry();
		for (var i = 0; i < freq.MAX_SAMPLES; i++) {
			geom.vertices.push(new THREE.Vector3(0, 0, -999));
		}
		this.nextPoint = 0;
		
		this.points = new THREE.PointCloud(geom, material);
		this.points.dynamic = true;
		this.scene.add(this.points);
	},
	
	initAxes: function() {
		var geom = new THREE.Geometry();
		var material = new THREE.LineBasicMaterial({
			color: 0x000000
		});
		// x
		geom.vertices.push(new THREE.Vector3(-1, 0, 0));
		geom.vertices.push(new THREE.Vector3(1, 0, 0));
		// y
		geom.vertices.push(new THREE.Vector3(0, -1, 0));
		geom.vertices.push(new THREE.Vector3(0, 1, 0));
		
		this.axes = new THREE.Line(geom, material, THREE.LinePieces);
		this.scene.add(this.axes);
	},
	
	addPoint: function(num) {
		if (!this.bugFix) {
			var vec = new THREE.Vector3(math.re(num), math.im(num), -this.tStep * this.nextPoint);
			var geom = this.points.geometry;
			geom.vertices[0] = vec;
			this.splineObj.geometry.vertices[0] = vec;
			this.splineObj.geometry.verticesNeedUpdate = true;
			this.bugFix = true;
			return;
		}
		var vec = new THREE.Vector3(math.re(num), math.im(num), -this.tStep * this.nextPoint);
		var geom = this.points.geometry;
		geom.vertices[this.nextPoint] = vec;
		this.nextPoint++;
		this.nums.push(num);
		geom.verticesNeedUpdate = true;
		
		var splineVecs = [];
		for (var i = 0; i < this.nums.length; i++) {
			splineVecs.push(new THREE.Vector3(math.re(this.nums[i]), math.im(this.nums[i]), 0));
		}
		this.spline = new THREE.Spline(splineVecs);
		this.spline.reparametrizeByArcLength ( 0.1 );
		for (var i = 0; i < freq.MAX_SPLINE; i++) {
			var t = i / freq.MAX_SPLINE;
			var p = this.spline.getPoint(t);
			var vec = new THREE.Vector3(p.x, p.y, p.z);
			this.splineObj.geometry.vertices[i] = vec;
		}
		this.splineObj.geometry.verticesNeedUpdate = true;
	},
	
	start: function() {
		this.init();
		this.scene.add(this.splineObj);
		if (!$("#splineOn").is(":checked")) {
			this.splineObj.visible = false;
		}
		this.scene.add(this.points);
		var geom = this.points.geometry;
		for (var i = 0; i < this.nums.length; i++) {
			geom.vertices[i].z /= this.nums.length;
		}
		geom.verticesNeedUpdate = true;
	
		var transf = new fft.Fft(this.nums);
		var N = transf.length;
		var formula = "";

		var phasorIndices = [];
		for (var i = 0; i < N; i++) {
			phasorIndices.push( {ind: i, r: math.divide(math.abs(transf[i]), N)} );
		}
		phasorIndices.sort(function(p1, p2) {
			return p2.r - p1.r;
			//return math.abs(p1.ind) - math.abs(p2.ind);
		});
		
		var formulaX = "";
		var formulaY = "";
		for (var i = 0; i < N; i++) {
			var num = transf[phasorIndices[i].ind];
			
			var r = math.divide(math.abs(num), 1);
			var pos;
			if (i > 0) {
				pos = this.phasors[i-1].getVec();
			} else {
				//var num = math.divide(transf[i], N);
				pos = new THREE.Vector3(0, 0, 0);
			}
			var phase = math.arg(num);
			var frequency = (phasorIndices[i].ind - math.floor(transf.length / 2)) / (this.tStep);
			var phasor = new freq.Phasor(r, pos, phase, frequency);
			
			this.phasors.push(phasor);
			this.scene.add(phasor.circle);
			if (i != 0) {
				var plus = (frequency < 0 ? "":"-");
				formulaX += r.toString() + " * cos(" + phase.toString() + plus + frequency.toString()+"*t)";
				formulaY += r.toString() + " * sin(" + phase.toString() + plus + frequency.toString()+"*t)";
				if (i != N-1) {
					formulaX += " + ";
					formulaY += " + ";
				}
			}
		}
		this.formula = formulaX + ", " + formulaY;
		$("#formula").text(this.formula);
		
		this.updateTimeStamp();
		//this.scene.remove(this.points);
		//this.scene.remove(this.splineObj);
		this.hasStarted = true;
		this.startDrawing();
	},
	
	startDrawing: function() {
		this.initTrajectory();
		this.isDrawing = true;
	},
	
	initTrajectory: function() {
		this.timeSinceLastTrajectory = 0;
		this.trajectoryIndex = 0;
		var geom = new THREE.Geometry();
		for (var i = 0; i < freq.MAX_TRAJECTORY; i++) {
			geom.vertices.push(new THREE.Vector3(0, 0, -999));
		}
		var material = new THREE.LineBasicMaterial({
			color: 0xff0000,
			linewidth: 2
		});
		this.trajectory = new THREE.Line(geom, material);
		this.trajectory.dynamic = true;
		this.trajectoryInterval = 1 / (freq.MAX_TRAJECTORY * 100000);
		this.scene.add(this.trajectory);
		this.updateTrajectory();
	},
	
	initSpline: function() {
		this.splineIndex = 0;
		var geom = new THREE.Geometry();
		for (var i = 0; i < freq.MAX_SPLINE; i++) {
			geom.vertices.push(new THREE.Vector3(0, 0, -999));
		}
		var material = new THREE.LineBasicMaterial({
			color: 0xffff00,
			linewidth: 2
		});
		this.splineObj = new THREE.Line(geom, material);
		this.splineObj.dynamic = true;
		this.scene.add(this.splineObj);
		
	},
	
	updateTimeStamp: function() {
		var d = new Date();
		var oldTime = this.timeStamp;
		this.timeStamp = d.getTime();
		return oldTime;
	},
	
	getTimeDiff: function(time) {
		return this.timeStamp - time;
	},
	
	step: function(diff) {
		this.t += diff;
		
		for (var i = 0; i < this.phasors.length; i++) {
			this.phasors[i].step(diff);
			if (i > 0) {
				this.phasors[i].setPos(this.phasors[i-1].getVec());
			}
		}
		if (this.isDrawing) {
			this.phasors[0].circle.position.setZ(-this.t);
			this.timeSinceLastTrajectory += diff;
			var d = this.timeSinceLastTrajectory - this.trajectoryInterval;
			if (d >= 0.0) {
				this.updateTrajectory();
				this.timeSinceLastTrajectory = d;
			}
		}
		
	},
	
	updateTrajectory: function() {
		var N = this.phasors.length;
		var point = this.phasors[math.floor((N-1)*1)].getVec();
		var geom = this.trajectory.geometry;
		geom.vertices[this.trajectoryIndex] = point;
		geom.verticesNeedUpdate = true;
		this.trajectoryIndex++;
		if (this.trajectoryIndex == freq.MAX_TRAJECTORY) {
			this.initTrajectory();
		}
	},
	
	mouseMoved: function(diff) {
		/*this.camera.rotateOnAxis(new THREE.Vector3(1, 0, 0), -diff.y / 1000);
		this.camera.rotateOnAxis(new THREE.Vector3(0, 1, 0), diff.x / 1000);*/
		var rot = math.complex({r: 1, phi: diff.x/300});
		this.cameraPos = math.multiply(rot, this.cameraPos);
		this.camera.position.copy(new THREE.Vector3(math.re(this.cameraPos), 0, math.im(this.cameraPos)));
		this.camera.lookAt(new THREE.Vector3(0, 0, 0));
	},
	
	
	getN: function() {
		var N = this.nums.length;
		if ($('#splineOn').is(':checked')) {
			N *= freq.SPLINE_SAMPLES;
			return math.floor(N*1.4 / (math.log(N) + 1));
		} else {
			return N;
		}
	},
	
	
};

function printNums() {
	var str = ""; for (var i = 0; i < freq.scene.nums.length; i++) {str += math.re(freq.scene.nums[i]).toString() + "," + math.im(freq.scene.nums[i]).toString() + " "}; console.log(str);
}
	