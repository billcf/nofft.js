/**
 * nofft.js - Licensed under the MIT license
 * https://github.com/williamfields/nofft.js
 */
 
	(function () { "use strict"; }());
	
	var NOFFT = function() 
	{				
		var self = this;				
		
		// Note handling
		this.ignoreNoteOff = false;		
		
		// Controllers
		this.modController = 1;
		this.decayController = 72;
		this.attackController = 73;
		
		// Envelope settings			
		this.minimumEnvelope = 0;
		this.maximumEnvelope = 1;						
		this.velocityCurve = 2;
		
		// Attack
		this.minimumAttack = 10;
		this.maximumAttack = 5000;
		this.attackCurve = 4;
		this.attackEasing = TWEEN.Easing.Linear.None;  // For options see: http://tweenjs.github.io/tween.js/examples/03_graphs.html
		
		// Decay		
		this.minimumDecay = 100;
		this.maximumDecay = 8000;
		this.decayCurve = 5;
		this.decayEasing = TWEEN.Easing.Exponential.Out;
		
		var ANY_CHANNEL = 17;  // Special channel that is triggered for events on all channels
		
		this.channel = new Array(18);
		
		for (var c=1; c<18; c++)
		{					
			this.channel[c] = 
			{		
				attack: 0.0,
				decay: 0.5,
				mod: 0,
				envelope: [],
				lastNote: 0,
				anyEnvelope: 0,
				tweens: [],
				noteOnInternal: function(chan,note,vel)
				{													
					this.lastNote = note;
				
					// If envelope is already running, then stop it.
					if (this.tweens[note] !== undefined)  
					{									
						this.tweens[note].stop();
					}

					if (self.ignoreNoteOff)
					{					
						// Attack
						var pos = { env:self.minimumEnvelope };			
						var attackTween = tween(
						{ 
							from:pos,
							to:{ env:self.maximumEnvelope*Math.pow(vel,self.velocityCurve) },
							speed:Math.max(self.maximumAttack*Math.pow(this.attack,self.attackCurve),self.minimumAttack),
							update:function() 
							{	
								if (note == self.channel[chan].lastNote) 
								{ 
									self.channel[chan].anyEnvelope = pos.env; 
								} 
								self.channel[chan].envelope[note] = pos.env; 
							},			
							mode:self.attackEasing
						});			
						
						// Release
						var pos2 = { env:self.maximumEnvelope*Math.pow(vel,self.velocityCurve) };
						var releaseTween = tween(
						{ 
							from:pos2,
							to:{ env:self.minimumEnvelope },
							speed:Math.max(self.maximumDecay*Math.pow(this.decay,self.decayCurve),self.minimumDecay),
							update:function() 
							{	
								if (note == self.channel[chan].lastNote) 
								{ 
									self.channel[chan].anyEnvelope = pos2.env; 
								} 
								self.channel[chan].envelope[note] = pos2.env; 
							},		
							mode:self.decayEasing,
							start:false,
							delay:10
						});			
									
						// Chain tweens together
						attackTween.chain(releaseTween);	
					}
					else
					{					
						// Attack
						var pos = { env:self.minimumEnvelope };
						this.tweens[note] = tween(
						{ 					
							from:pos,
							to:{ env:self.maximumEnvelope*Math.pow(vel,self.velocityCurve) },
							speed:Math.max(self.maximumAttack*Math.pow(this.attack,self.attackCurve),self.minimumAttack),
							update:function() 
							{	
								if (note == self.channel[chan].lastNote) 
								{ 
									self.channel[chan].anyEnvelope = pos.env; 
								} 
								self.channel[chan].envelope[note] = pos.env; 
							},
							mode:self.attackEasing
						});					
					}
					
					// Call user-defined note-on function
					this.noteOn(note,vel); 
				},
				noteOffInternal: function(chan,note) 
				{							
					// If envelope is already running, then stop it.
					if (this.tweens[note] !== undefined) 
					{			
						this.tweens[note].stop();			
					}

					// Create new envelope
					var pos = { env:self.channel[chan].envelope[note] };
					this.tweens[note] = tween(
					{ 
						from:pos,
						to:{ env:self.minimumEnvelope },
						speed:self.maximumDecay*Math.pow(this.decay,self.decayCurve),
						update:function() 
						{								
							self.channel[chan].envelope[note] = pos.env; 
						},				
						mode:self.decayEasing
					});		
					
					// Call user-defined note-off function
					this.noteOff(note); 
				},
				controllerInternal: function(chan, cnum,cval) 
				{ 
					if (cnum == self.attackController) { this.attack = cval; }
					else if (cnum == self.decayController) { this.decay = cval; }
					else if (cnum == self.modController) { this.mod = cval; }

					// Call user-defined controller function
					this.controller(cnum,cval); 
				},			
				noteOn: function(note,vel) { }, // User defined
				noteOff: function(note) { }, // User defined
				controller: function(cnum, cval) { },  // User defined
			};
			
			// Init envelope values
			for (var i=0; i<128; i++)
			{
				this.channel[c].envelope[i] = 0;
			}
		}	
		
		
		this.anyChannel = this.channel[ANY_CHANNEL];
			
			
		this.init = function()
		{			
			if (!navigator.requestMIDIAccess) 
			{		
				console.log("Browser does not support WebMIDI!");				
			} 
			else 
			{			
				navigator.requestMIDIAccess({ sysex:false }).then(onMidiAccess, errorCallback);	
			}							
		};
			
			
		this.update = function()
		{
			TWEEN.update(); 
		}
		
		
		function onMidiAccess(midi) 
		{		
			var inputs = midi.inputs.values();
			
			for (var input=inputs.next(); input && !input.done; input=inputs.next())
			{
				if (typeof input.value !== "undefined")
				{
					console.log("MIDI input: " +input.value.name);
					input.value.onmidimessage = onMidiMessage;  // TODO: Should be able to choose which device instead of opening all
				}
			}						
		}
		
		
		function errorCallback(err) 
		{
			alert("The MIDI system failed to start:" + err);
		}
		
				
		function onMidiMessage(msg)	
		{																					
			var status = msg.data[0] & 240;
			var chan = msg.data[0] - status + 1;		
																																				
			if (status <= 159)  // Note event  
			{    					
				var note = msg.data[1];
				var velocity = msg.data[2];
			
				if (velocity > 0)	
				{						
					// Note on
					self.channel[chan].noteOnInternal(chan, note, velocity/127);
					self.anyChannel.noteOnInternal(ANY_CHANNEL, note, velocity/127);
				}	
				else 
				{				
					// Note off				
					self.channel[chan].noteOffInternal(chan, note);
					self.anyChannel.noteOffInternal(ANY_CHANNEL, note);
				}
			}
			else if (status == 176)  // Controller event
			{							
				var controllerNumber = msg.data[1];
				var controllerValue = msg.data[2];								
				self.channel[chan].controllerInternal(chan, controllerNumber, controllerValue/127);
				self.anyChannel.controllerInternal(ANY_CHANNEL, controllerNumber, controllerValue/127);
			}						
		}				
		
		
		function tween(args) 
		{	
			args = args || {};
			
			var from = typeof args.from != 'undefined' ? args.from : 0;
			var target = typeof args.to != 'undefined' ? args.to : 1;
			var speed = typeof args.speed != 'undefined' ? args.speed : 1000;
			var update = typeof args.update != 'undefined' ? args.update : function() { log("No tween update function defined."); };
			var mode = typeof args.mode != 'undefined' ? args.mode : TWEEN.Easing.Linear.None;
			var start = typeof args.start !== 'undefined' ? args.start : true;
			var delay = typeof args.delay !== 'undefined' ? args.delay : 0;
			
			var myTween = new TWEEN.Tween(from).to(target,speed);
			myTween.onUpdate(update);						
			myTween.easing(mode);
			
			if (delay > 0) { myTween.delay(delay); }
			
			if (start) { myTween.start(); }
			
			return myTween;
		}

	};