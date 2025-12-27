import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEvaluations } from '@/hooks/useEvaluations';
import { useKPITemplates } from '@/hooks/useKPITemplates';
import { useTeamManagement } from '@/hooks/useTeamManagement';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowRight, Save, Send, Loader2, CheckCircle, AlertTriangle, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TemplateAxis {
  id: string;
  name: string;
  name_en: string | null;
  weight: number;
  sort_order: number;
}

interface TemplateQuestion {
  id: string;
  axis_id: string;
  question_text: string;
  question_text_en: string | null;
  answer_type: 'numeric' | 'choice' | 'text';
  min_value: number | null;
  max_value: number | null;
  choices: { value: string; label: string; score: number }[] | null;
  weight: number;
  sort_order: number;
}

interface Answer {
  question_id: string;
  numeric_value: number | null;
  choice_value: string | null;
  text_value: string | null;
  score: number | null;
}

export default function EvaluationForm() {
  const { evaluationId } = useParams<{ evaluationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { evaluations, cycles, answers: savedAnswers, saveAnswer, submitEvaluation, getAnswersByEvaluation } = useEvaluations();
  const { users } = useTeamManagement();
  
  const [axes, setAxes] = useState<TemplateAxis[]>([]);
  const [questions, setQuestions] = useState<TemplateQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentAxisIndex, setCurrentAxisIndex] = useState(0);

  const evaluation = evaluations.find(e => e.id === evaluationId);
  const cycle = cycles.find(c => c.id === evaluation?.cycle_id);
  
  const profiles = users.map(u => ({ user_id: u.profile.user_id, full_name: u.profile.full_name, email: u.profile.email }));
  const getEvaluateeName = (userId: string) => {
    const profile = profiles.find(p => p.user_id === userId);
    return profile?.full_name || profile?.email || 'غير معروف';
  };

  // Load template axes and questions
  useEffect(() => {
    const loadTemplateData = async () => {
      if (!cycle?.template_id) return;

      try {
        // Load axes
        const { data: axesData, error: axesError } = await supabase
          .from('kpi_template_axes')
          .select('*')
          .eq('template_id', cycle.template_id)
          .order('sort_order');

        if (axesError) throw axesError;
        setAxes(axesData || []);

        // Load questions
        const { data: questionsData, error: questionsError } = await supabase
          .from('kpi_template_questions')
          .select('*')
          .in('axis_id', (axesData || []).map(a => a.id))
          .order('sort_order');

        if (questionsError) throw questionsError;
        
        // Parse choices properly
        const parsedQuestions = (questionsData || []).map(q => ({
          ...q,
          choices: q.choices ? (typeof q.choices === 'string' ? JSON.parse(q.choices) : q.choices) : null
        }));
        setQuestions(parsedQuestions);

        // Load existing answers
        if (evaluationId) {
          const existingAnswers = getAnswersByEvaluation(evaluationId);
          const answersMap: Record<string, Answer> = {};
          existingAnswers.forEach(a => {
            answersMap[a.question_id] = {
              question_id: a.question_id,
              numeric_value: a.numeric_value,
              choice_value: a.choice_value,
              text_value: a.text_value,
              score: a.score,
            };
          });
          setAnswers(answersMap);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading template data:', error);
        toast({ title: 'خطأ في تحميل القالب', variant: 'destructive' });
        setLoading(false);
      }
    };

    loadTemplateData();
  }, [cycle?.template_id, evaluationId, savedAnswers]);

  const handleAnswerChange = (questionId: string, value: number | string, type: 'numeric' | 'choice' | 'text') => {
    const question = questions.find(q => q.id === questionId);
    let score: number | null = null;

    if (type === 'numeric' && question) {
      // Calculate score based on the value and question weight
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      const maxValue = question.max_value || 5;
      score = (numValue / maxValue) * question.weight;
    } else if (type === 'choice' && question?.choices) {
      const choice = question.choices.find(c => c.value === value);
      if (choice) {
        score = choice.score * question.weight;
      }
    }

    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        numeric_value: type === 'numeric' ? (typeof value === 'number' ? value : parseFloat(value)) : null,
        choice_value: type === 'choice' ? String(value) : null,
        text_value: type === 'text' ? String(value) : null,
        score,
      }
    }));
  };

  const handleSave = async () => {
    if (!evaluationId) return;
    setSaving(true);

    try {
      for (const [questionId, answer] of Object.entries(answers)) {
        await saveAnswer.mutateAsync({
          evaluation_id: evaluationId,
          question_id: questionId,
          numeric_value: answer.numeric_value,
          choice_value: answer.choice_value,
          text_value: answer.text_value,
          score: answer.score,
        });
      }
      toast({ title: 'تم حفظ الإجابات بنجاح' });
    } catch (error: any) {
      toast({ title: 'خطأ في الحفظ', description: error.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!evaluationId) return;

    // Validate all questions are answered
    const unansweredQuestions = questions.filter(q => !answers[q.id]);
    if (unansweredQuestions.length > 0) {
      toast({ 
        title: 'يجب الإجابة على جميع الأسئلة', 
        description: `${unansweredQuestions.length} سؤال لم تتم الإجابة عليه`,
        variant: 'destructive' 
      });
      return;
    }

    setSubmitting(true);
    try {
      // Save all answers first
      await handleSave();
      
      // Submit the evaluation
      await submitEvaluation.mutateAsync(evaluationId);
      
      toast({ title: 'تم إرسال التقييم بنجاح' });
      navigate('/evaluations');
    } catch (error: any) {
      toast({ title: 'خطأ في الإرسال', description: error.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Calculate progress
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(answers).length;
  const progress = totalQuestions > 0 ? (answeredQuestions / totalQuestions) * 100 : 0;

  // Calculate total score
  const calculateTotalScore = () => {
    let total = 0;
    Object.values(answers).forEach(a => {
      if (a.score !== null) total += a.score;
    });
    return total;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!evaluation) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>التقييم غير موجود</AlertDescription>
      </Alert>
    );
  }

  const currentAxis = axes[currentAxisIndex];
  const currentQuestions = questions.filter(q => q.axis_id === currentAxis?.id);

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/evaluations')}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">تقييم الأداء</h1>
          <p className="text-muted-foreground">
            {cycle?.name} - تقييم: {getEvaluateeName(evaluation.evaluatee_id)}
          </p>
        </div>
        <Badge variant={evaluation.status === 'draft' ? 'secondary' : 'default'}>
          {evaluation.status === 'draft' ? 'مسودة' : 'قيد التنفيذ'}
        </Badge>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">التقدم</span>
            <span className="text-sm text-muted-foreground">
              {answeredQuestions} / {totalQuestions} سؤال
            </span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>الدرجة المؤقتة: {calculateTotalScore().toFixed(1)}</span>
            <span>{progress.toFixed(0)}% مكتمل</span>
          </div>
        </CardContent>
      </Card>

      {/* Evaluatee Info */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">{getEvaluateeName(evaluation.evaluatee_id)}</p>
              <p className="text-sm text-muted-foreground">الموظف المُقيَّم</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Axis Navigation */}
      <div className="flex flex-wrap gap-2">
        {axes.map((axis, index) => {
          const axisQuestions = questions.filter(q => q.axis_id === axis.id);
          const axisAnswered = axisQuestions.filter(q => answers[q.id]).length;
          const isComplete = axisAnswered === axisQuestions.length && axisQuestions.length > 0;
          
          return (
            <Button
              key={axis.id}
              variant={index === currentAxisIndex ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCurrentAxisIndex(index)}
              className="gap-2"
            >
              {isComplete && <CheckCircle className="h-4 w-4 text-green-500" />}
              {axis.name}
              <Badge variant="secondary" className="mr-1">
                {axisAnswered}/{axisQuestions.length}
              </Badge>
            </Button>
          );
        })}
      </div>

      {/* Current Axis Questions */}
      {currentAxis && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{currentAxis.name}</span>
              <Badge>وزن المحور: {currentAxis.weight}%</Badge>
            </CardTitle>
            {currentAxis.name_en && (
              <CardDescription>{currentAxis.name_en}</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {currentQuestions.map((question, qIndex) => (
              <div key={question.id} className="space-y-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                    {qIndex + 1}
                  </span>
                  <div className="flex-1">
                    <Label className="text-base font-medium">{question.question_text}</Label>
                    {question.question_text_en && (
                      <p className="text-sm text-muted-foreground" dir="ltr">{question.question_text_en}</p>
                    )}
                    <Badge variant="outline" className="mt-1">وزن: {question.weight}</Badge>
                  </div>
                </div>

                {question.answer_type === 'numeric' && (
                  <div className="space-y-2 pr-8">
                    <div className="flex items-center gap-4">
                      <Slider
                        value={[answers[question.id]?.numeric_value ?? question.min_value ?? 1]}
                        min={question.min_value ?? 1}
                        max={question.max_value ?? 5}
                        step={1}
                        onValueChange={([value]) => handleAnswerChange(question.id, value, 'numeric')}
                        className="flex-1"
                      />
                      <span className="w-12 text-center font-bold text-lg">
                        {answers[question.id]?.numeric_value ?? '-'}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{question.min_value ?? 1} (ضعيف)</span>
                      <span>{question.max_value ?? 5} (ممتاز)</span>
                    </div>
                  </div>
                )}

                {question.answer_type === 'choice' && question.choices && (
                  <RadioGroup
                    value={answers[question.id]?.choice_value ?? ''}
                    onValueChange={(value) => handleAnswerChange(question.id, value, 'choice')}
                    className="pr-8 space-y-2"
                  >
                    {question.choices.map((choice) => (
                      <div key={choice.value} className="flex items-center gap-2">
                        <RadioGroupItem value={choice.value} id={`${question.id}-${choice.value}`} />
                        <Label htmlFor={`${question.id}-${choice.value}`} className="cursor-pointer">
                          {choice.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}

                {question.answer_type === 'text' && (
                  <Textarea
                    value={answers[question.id]?.text_value ?? ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value, 'text')}
                    placeholder="أدخل إجابتك..."
                    className="pr-8"
                    rows={3}
                  />
                )}

                {qIndex < currentQuestions.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Navigation & Actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setCurrentAxisIndex(prev => Math.max(0, prev - 1))}
            disabled={currentAxisIndex === 0}
          >
            المحور السابق
          </Button>
          <Button
            variant="outline"
            onClick={() => setCurrentAxisIndex(prev => Math.min(axes.length - 1, prev + 1))}
            disabled={currentAxisIndex === axes.length - 1}
          >
            المحور التالي
          </Button>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            <Save className="h-4 w-4 ml-2" />
            حفظ
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || progress < 100}>
            {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            <Send className="h-4 w-4 ml-2" />
            إرسال التقييم
          </Button>
        </div>
      </div>
    </div>
  );
}
