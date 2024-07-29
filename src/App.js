import React, { useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { Button, Container, Typography, Card, CardContent, CircularProgress, Box } from '@mui/material';

const socket = io('http://localhost:5000');

const App = () => {
  const [isListening, setIsListening] = useState(false);
  const [latestTranscript, setLatestTranscript] = useState('');
  const [serverPrompt, setServerPrompt] = useState('');
  const [interviewStarted, setInterviewStarted] = useState(false);
  const [intervalId, setIntervalId] = useState(null);
  const audioRef = useRef(null);

  const { transcript, browserSupportsSpeechRecognition, resetTranscript } = useSpeechRecognition();

  useEffect(() => {
    socket.on('audio', (data) => {
      try {
        const audioBlob = new Blob([new Uint8Array(atob(data.audio_data).split("").map(c => c.charCodeAt(0)))], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(audioBlob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play().then(() => {
            URL.revokeObjectURL(url);
          }).catch(error => {
            console.error('Error playing audio:', error);
            URL.revokeObjectURL(url);
          });
        }
      } catch (error) {
        console.error('Error decoding or playing audio:', error);
      }
    });

    socket.on('question', (data) => {
      setServerPrompt(data.question);
    });

    return () => {
      socket.off('audio');
      socket.off('question');
    };
  }, []);

  useEffect(() => {
    if (isListening) {
      const id = setInterval(() => {
        if (transcript) {
          setLatestTranscript(transcript);
          socket.emit('transcript', { data: transcript });
          resetTranscript();
        }
      }, 1000); 

      setIntervalId(id);

      return () => clearInterval(id);
    } else {
      if (intervalId) {
        clearInterval(intervalId);
        setIntervalId(null);
      }
    }
  }, [isListening, transcript, resetTranscript]);

  const handleStartListening = () => {
    SpeechRecognition.startListening({ continuous: true });
    setIsListening(true);
    setInterviewStarted(true);
    socket.emit('start_interview');
  };



  if (!browserSupportsSpeechRecognition) {
    return <Typography variant="h6" color="error">Browser doesn't support speech recognition.</Typography>;
  }

  return (
    <Container maxWidth="sm">
      <Card variant="outlined" sx={{ marginTop: 4 }}>
        <CardContent>
          <Typography variant="h4" component="h1" gutterBottom>
            Interview Questionnaire
          </Typography>
          <Box sx={{ textAlign: 'center', marginBottom: 2 }}>
            <Typography variant="h6">Microphone: {isListening ? 'on' : 'off'}</Typography>
            <Box sx={{ marginTop: 2 }}>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleStartListening}
                disabled={isListening}
                sx={{ marginRight: 2 }}
              >
                Start Interview
              </Button>

            </Box>
          </Box>

          {interviewStarted && (
            <Box sx={{ marginTop: 2 }}>
              <Typography variant="h6">Transcript:</Typography>
              <Card variant="outlined" sx={{ marginTop: 2, padding: 2 }}>
                <Typography variant="body1">{latestTranscript || <CircularProgress />}</Typography>
              </Card>
            </Box>
          )}

          {interviewStarted && serverPrompt && (
            <Box sx={{ marginTop: 2 }}>
              <Typography variant="body1" color="textSecondary">{serverPrompt}</Typography>
            </Box>
          )}

          <audio ref={audioRef} style={{ display: 'none' }}></audio>
        </CardContent>
      </Card>
    </Container>
  );
};

export default App;
