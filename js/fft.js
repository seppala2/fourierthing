fft = {};


fft.Fft = function(samples) {
	this.samples = samples;
	this.N = samples.length;
	
	this.t = numeric.linspace(0,1,this.N);
	var vecSamples = [];
	for (var i = 0; i < this.N; i++) {
		var vec = new THREE.Vector3(math.re(samples[i]), math.im(samples[i]), 0);
		vecSamples.push(vec);
	}
	
	this.newSamples = this.samples;
	this.newN = this.N;
	if ($('#splineOn').is(':checked')) {
		this.spline = new THREE.Spline(vecSamples);
		this.spline.reparametrizeByArcLength ( 0.1 );
		
		this.newN = freq.SPLINE_SAMPLES*this.N;
		this.newSamples = [];
		for (var i = 0; i < this.newN; i++) {
			var t = i / (this.newN);
			var num =  this.spline.getPoint(t);
			this.newSamples.push(math.complex(num.x, num.y));
		}
	}
	
	var isPowerOfTwo = !(this.newN == 0) && !(this.newN & (this.newN - 1));
	/*if (isPowerOfTwo) {
		this.result = this.ditfft22(this.newSamples, this.newN, 1, 0);
		var finalN = this.result.length - 5;//math.floor(this.result.length);
		this.result.splice(finalN, this.result.length-finalN);
		for (var i = 0; i < this.result.length; i++) {
			this.result[i] = math.multiply(this.result[i], 1/this.newN);
		}
	} else {
		this.result = this.coeffs(this.newSamples, this.newN);
	}*/
	this.result = this.coeffs(this.newSamples, this.newN);
	//this.result = this.coeffs(this.samples, this.N);
	/*if (isPowerOfTwo) {
		this.result = this.ditfft2(this.newSamples, this.newN, 1, 0);
	} else {
		console.log("Amount of samples (" + this.newN.toString() + ") not power of two. Using brute-force algorithm");
		this.result = this.brute(this.newSamples, this.newN);
	}*/
	return this.result;
	
	
};

fft.Fft.prototype = {
	ditfft2: function ditfft2(x, N, s, shift) {
		var result = [];
		if (N == 1) {
			result.push(x[shift]);
		} else {
			var first = ditfft2(x, N/2, 2*s, shift);
			result = result.concat(first);
			result = result.concat(ditfft2(x, N/2, 2*s, shift + s));
			for (var k = 0; k < N/2; k++) {
				var temp = result[k];
				var e = math.exp(  math.divide(math.multiply(math.multiply(-2, math.multiply(math.i, math.pi)), k), N)  );
				result[k] = math.add( temp, math.multiply(e, result[k + N/2]) );
				result[k + N/2] = math.subtract( temp, math.multiply(e, result[k + N/2]) );
			}
		}
		return result;
	},
	
	ditfft22: function ditfft22(x, N, s, shift) {
		var result = [];
		if (N == 1) {
			result.push(x[shift]);
		} else {
			var first = ditfft22(x, N/2, 2*s, shift);
			result = result.concat(first);
			result = result.concat(ditfft22(x, N/2, 2*s, shift + s));
			for (var k = 0; k < N/2; k++) {
				var temp = result[k];
				var e = math.exp(  math.divide(math.multiply(math.multiply(-2, math.multiply(math.i, math.pi)), k), N)  );
				result[k] = math.add( temp, math.multiply(e, result[k + N/2]) );
				result[k + N/2] = math.subtract( temp, math.multiply(e, result[k + N/2]) );
			}
		}
		return result;
	},
	
	coeffs: function(x, N) {
		var result = [];
		var numCoeffs = $("#slider").slider('value');
		for (var i = 0; i < numCoeffs; i++) {
			var k = i - math.floor(numCoeffs / 2);
			result.push(math.complex(0, 0));
			for (var n = 0; n < N; n++) {
				var e = math.exp(  math.divide(math.multiply(math.multiply(math.multiply(-2, math.multiply(math.i, math.pi)), k), n), N)  );
				var ex = math.multiply(e, x[n]);
				/*var e2 = math.exp(  math.divide(math.multiply(math.multiply(math.multiply(-2, math.multiply(math.i, math.pi)), k), n+1), N)  );
				var ex2 = math.multiply(e, x[n+1]);
				var avg = math.multiply(math.add(ex, ex2), 0.5 / N);*/
				//result[i] = math.add(result[i], avg);
				result[i] = math.add(result[i], math.multiply(ex, 1 / N));
			}
			/*for (var n = 0; n < N-1; n++) {
				var e = math.exp(  math.divide(math.multiply(math.multiply(math.multiply(-2, math.multiply(math.i, math.pi)), k), n), N)  );
				var ex = math.multiply(e, x[n]);
				
				var e2 = math.exp(  math.divide(math.multiply(math.multiply(math.multiply(-2, math.multiply(math.i, math.pi)), k), n+0.5), N)  );
				var ex2 = math.multiply(e, math.multiply(math.add(x[n+1], x[n]), 0.5));
				ex2 = math.multiply(ex2, 4);
				
				var e3 = math.exp(  math.divide(math.multiply(math.multiply(math.multiply(-2, math.multiply(math.i, math.pi)), k), n+1), N)  );
				var ex3 = math.multiply(e, x[n+1]);
				
				var avg = math.multiply(math.add(math.add(ex, ex2), ex3), 1/6);
				
				result[i] = math.add(result[i], avg);
			}*/
		}
		return result;
	}
	
	
};