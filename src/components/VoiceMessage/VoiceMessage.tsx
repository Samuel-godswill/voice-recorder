import React, { useState, useRef, useEffect } from 'react';
import './VoiceMessage.css';

interface StoredRecording {
  id: string;
  url: string;
  blob: Blob;
  timestamp: Date;
  duration: number;
  name?: string;
}

interface AudioRecorderProps {
  profileImage?: string;
}

const VoiceMessage: React.FC<AudioRecorderProps> = ({ 
    profileImage = '/src/assets/me.JPG'  
}) => {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(0);
  
  const [showModal, setShowModal] = useState<boolean>(false);
  const [storedRecordings, setStoredRecordings] = useState<StoredRecording[]>([]);
  const [currentPlayingId, setCurrentPlayingId] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const modalAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    try {
      const savedRecordings = localStorage.getItem('voiceRecordings');
      if (savedRecordings) {
        const parsedRecordings = JSON.parse(savedRecordings);
        setStoredRecordings(parsedRecordings.map((rec: any) => ({
          ...rec,
          timestamp: new Date(rec.timestamp),
          blob: null 
        })));
      }
    } catch (error) {
      console.error("Error loading stored recordings:", error);
    }
  }, []);

  useEffect(() => {
    try {
      const serializableRecordings = storedRecordings.map(rec => ({
        id: rec.id,
        url: rec.url,
        timestamp: rec.timestamp.toISOString(),
        duration: rec.duration,
        name: rec.name
      }));
      localStorage.setItem('voiceRecordings', JSON.stringify(serializableRecordings));
    } catch (error) {
      console.error("Error saving recordings to localStorage:", error);
    }
  }, [storedRecordings]);

  const startRecording = async (): Promise<void> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Failed to access microphone. Please ensure you've granted permission.");
    }
  };

  const stopRecording = (): void => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };

  const togglePlayback = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (!audioElementRef.current) return;
    
    if (isPlaying) {
      audioElementRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElementRef.current.play();
      setIsPlaying(true);
    }
  };

  const deleteRecording = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setDuration(0);
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
  };

  const handleRecordButtonClick = (e: React.MouseEvent): void => {
    e.stopPropagation();
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const saveRecording = () => {
    if (!audioBlob || !audioUrl) return;
    
    const newRecording: StoredRecording = {
      id: `recording-${Date.now()}`,
      url: audioUrl,
      blob: audioBlob,
      timestamp: new Date(),
      duration: duration,
      name: `Recording ${storedRecordings.length + 1}`
    };
    
    setStoredRecordings(prev => [...prev, newRecording]);
  };

  const toggleModalPlayback = (recordingId: string, recordingUrl: string) => {
    if (!modalAudioRef.current) return;
    
    if (currentPlayingId === recordingId) {
      modalAudioRef.current.pause();
      setCurrentPlayingId(null);
    } else {
      if (currentPlayingId) {
        modalAudioRef.current.pause();
      }
      
      modalAudioRef.current.src = recordingUrl;
      modalAudioRef.current.play();
      setCurrentPlayingId(recordingId);
    }
  };

  const deleteStoredRecording = (recordingId: string) => {
    const recordingToDelete = storedRecordings.find(rec => rec.id === recordingId);
    if (recordingToDelete && recordingToDelete.url) {
      URL.revokeObjectURL(recordingToDelete.url);
    }
    
    setStoredRecordings(prev => prev.filter(rec => rec.id !== recordingId));
    
    if (currentPlayingId === recordingId && modalAudioRef.current) {
      modalAudioRef.current.pause();
      setCurrentPlayingId(null);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  useEffect(() => {
    const audioElement = audioElementRef.current;
    
    if (audioElement) {
      const handleLoadedMetadata = () => {
        setDuration(audioElement.duration);
      };
      
      const handleEnded = () => {
        setIsPlaying(false);
        audioElement.currentTime = 0;
      };
      
      audioElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioElement.addEventListener('ended', handleEnded);
      
      return () => {
        audioElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioElement.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioUrl]);
  
  useEffect(() => {
    const modalAudio = modalAudioRef.current;
    
    if (modalAudio) {
      const handleModalAudioEnded = () => {
        setCurrentPlayingId(null);
      };
      
      modalAudio.addEventListener('ended', handleModalAudioEnded);
      
      return () => {
        modalAudio.removeEventListener('ended', handleModalAudioEnded);
      };
    }
  }, []);
  
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      
      storedRecordings.forEach(rec => {
        if (rec.url) {
          URL.revokeObjectURL(rec.url);
        }
      });
    };
  }, []);

  return (
    <div className="voice-message-wrapper">
      <button 
        className="saved-recordings-button"
        onClick={() => setShowModal(true)}
        aria-label="View saved recordings"
      >
        <svg className="saved-icon" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-2 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H7V4h8v4z" />
        </svg>
        {storedRecordings.length > 0 && (
          <span className="recordings-count">{storedRecordings.length}</span>
        )}
      </button>
    
      <div className="voice-message-container">      
        <div className="voice-message-content">
          <div className="profile-container">
            <div className="profile-image">
              <img src={profileImage} alt="" />
            </div>
          </div>
          
          <div className={`controls-container ${audioBlob ? 'playback-mode' : ''}`}>
            {!audioBlob ? (
              <button
                onClick={handleRecordButtonClick}
                className={`control-button ${isRecording ? 'recording' : ''}`}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? (
                  <svg className="icon" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                ) : (
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3z" />
                    <path d="M17 12c0 2.76-2.24 5-5 5s-5-2.24-5-5h-2c0 3.53 2.61 6.43 6 6.92V21h2v-2.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </button>
            ) : (
              <div className="playback-controls">
                <button
                  onClick={togglePlayback}
                  className="control-button play-button"
                  aria-label={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <svg className="icon" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="icon" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7L8 5z" />
                    </svg>
                  )}
                </button>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    saveRecording();
                  }}
                  className="control-button save-button"
                  aria-label="Save recording"
                >
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm3-10H5V5h10v4z" />
                  </svg>
                </button>
                
                <button
                  onClick={deleteRecording}
                  className="control-button delete-button"
                  aria-label="Delete recording"
                >
                  <svg className="icon" viewBox="0 0 24 24">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        </div>
        
        {audioUrl && (
          <audio 
            ref={audioElementRef} 
            src={audioUrl} 
            className="hidden-audio"
          />
        )}
      </div>
      
      {showModal && (
        <div className="recordings-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="recordings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Saved Recordings</h2>
              <button 
                className="close-modal-button"
                onClick={() => setShowModal(false)}
              >
                <svg viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                </svg>
              </button>
            </div>
            
            <div className="recordings-list">
              {storedRecordings.length === 0 ? (
                <div className="no-recordings">
                  <p>No recordings saved yet.</p>
                </div>
              ) : (
                storedRecordings.map((recording) => (
                  <div key={recording.id} className="recording-item">
                    <div className="recording-info">
                      <h3>{recording.name}</h3>
                      <p>{formatDate(recording.timestamp)} • {formatDuration(recording.duration)}</p>
                    </div>
                    
                    <div className="recording-actions">
                      <button
                        onClick={() => toggleModalPlayback(recording.id, recording.url)}
                        className="control-button play-button"
                      >
                        {currentPlayingId === recording.id ? (
                          <svg className="icon" viewBox="0 0 24 24">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                          </svg>
                        ) : (
                          <svg className="icon" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7L8 5z" />
                          </svg>
                        )}
                      </button>
                      
                      <button
                        onClick={() => deleteStoredRecording(recording.id)}
                        className="control-button delete-button"
                      >
                        <svg className="icon" viewBox="0 0 24 24">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <audio 
            ref={modalAudioRef} 
            className="hidden-audio" 
            onEnded={() => setCurrentPlayingId(null)}
          />
        </div>
      )}
    </div>
  );
};

export default VoiceMessage;