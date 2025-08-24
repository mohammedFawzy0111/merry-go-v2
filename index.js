/* eslint-disable import/no-duplicates */
import 'ses';
import { lockdown } from 'ses';

// Harden JS environment before anything else runs
lockdown();

// Hand off control to Expo Router
// eslint-disable-next-line import/first
import "expo-router/entry";

