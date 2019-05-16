var noise = new Tone.Noise("white");
noise.volume.value = -55;

function scribbleNoise(type) {
	if (Tone.context.state !== 'running') {
	  Tone.context.resume();
	}
	if (type === 'thick') {
		noise.volume.value = -50;
		noise._playbackRate = 0.5;
	} else if (type === 'dither') {
		noise.volume.value = -55;
		noise._playbackRate = 0.35;
	} else { // thin
		noise.volume.value = -55;
		noise._playbackRate = 1;
	}
 noise.toMaster();
 noise.start().stop('+0.1');
}
