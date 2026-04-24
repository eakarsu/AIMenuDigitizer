import {
  AlertTriangle,
  Flame,
  Check,
  Info,
  Zap,
  Heart,
  Activity,
  Leaf,
  Wheat,
  Coffee,
  UtensilsCrossed,
  Star,
  TrendingUp,
  Shield,
  Globe2,
  Sparkles,
  DollarSign,
  Target,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Utensils,
  ThumbsUp,
  Award,
  CircleDollarSign,
  Lightbulb,
  AlertCircle,
  Stethoscope,
  Pill,
  HeartPulse,
  Scale
} from 'lucide-react';

interface AIResultDisplayProps {
  title: string;
  result: any;
  type: 'allergens' | 'calories' | 'translation' | 'menu' | 'price' | 'recommendation' | 'healthcare';
}

export default function AIResultDisplay({ title, result, type }: AIResultDisplayProps) {
  if (!result || !result.analysis) return null;

  const analysis = result.analysis;

  const getSeverityGradient = (severity: string) => {
    switch (severity) {
      case 'high': return 'from-red-500 to-rose-600';
      case 'moderate': return 'from-amber-500 to-orange-500';
      default: return 'from-green-500 to-emerald-500';
    }
  };

  const renderAllergens = () => (
    <div className="space-y-6">
      {/* Summary */}
      {analysis.summary && (
        <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-2xl p-5 border border-gray-200">
          <p className="text-gray-700 leading-relaxed">{analysis.summary}</p>
        </div>
      )}

      {/* Summary Stats */}
      {analysis.allergens && analysis.allergens.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-xl p-4 text-white text-center">
            <div className="text-3xl font-bold">{analysis.allergens.filter((a: any) => a.severity === 'high').length}</div>
            <div className="text-sm opacity-90">High Risk</div>
          </div>
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-4 text-white text-center">
            <div className="text-3xl font-bold">{analysis.allergens.filter((a: any) => a.severity === 'moderate').length}</div>
            <div className="text-sm opacity-90">Moderate</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-4 text-white text-center">
            <div className="text-3xl font-bold">{analysis.allergens.filter((a: any) => a.severity === 'low').length}</div>
            <div className="text-sm opacity-90">Low Risk</div>
          </div>
        </div>
      )}

      {/* Cross Contamination Risk */}
      {analysis.cross_contamination_risk && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${
          analysis.cross_contamination_risk === 'high' ? 'bg-red-50 border-red-200' :
          analysis.cross_contamination_risk === 'moderate' ? 'bg-amber-50 border-amber-200' :
          'bg-green-50 border-green-200'
        }`}>
          <AlertCircle className={`h-6 w-6 ${
            analysis.cross_contamination_risk === 'high' ? 'text-red-500' :
            analysis.cross_contamination_risk === 'moderate' ? 'text-amber-500' :
            'text-green-500'
          }`} />
          <div>
            <span className="font-medium text-gray-900">Cross Contamination Risk: </span>
            <span className={`font-bold uppercase ${
              analysis.cross_contamination_risk === 'high' ? 'text-red-600' :
              analysis.cross_contamination_risk === 'moderate' ? 'text-amber-600' :
              'text-green-600'
            }`}>{analysis.cross_contamination_risk}</span>
          </div>
        </div>
      )}

      {/* Allergens */}
      {analysis.allergens && analysis.allergens.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-red-500 to-orange-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Detected Allergens ({analysis.allergens.length})
            </h4>
          </div>
          <div className="p-4 space-y-3">
            {analysis.allergens.map((a: any, i: number) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl border border-gray-100 bg-gradient-to-r from-gray-50 to-white p-4 hover:shadow-md transition-all"
              >
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${getSeverityGradient(a.severity)}`} />
                <div className="flex items-start justify-between gap-3 pl-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {a.icon && <span className="text-xl">{a.icon}</span>}
                      <span className="font-semibold text-gray-900 text-lg">{a.name}</span>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        a.severity === 'high' ? 'bg-red-100 text-red-700' :
                        a.severity === 'moderate' ? 'bg-amber-100 text-amber-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {a.severity}
                      </span>
                    </div>
                    {a.description && (
                      <p className="text-gray-600 text-sm leading-relaxed">{a.description}</p>
                    )}
                  </div>
                  {a.confidence && (
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded-lg">
                        <TrendingUp className="h-3 w-3 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">{a.confidence}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dietary Info */}
      {analysis.dietary_info && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Dietary Compatibility
            </h4>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(analysis.dietary_info).map(([key, value]) => (
                <div
                  key={key}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    value
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    value ? 'bg-green-500' : 'bg-gray-300'
                  }`}>
                    {value ? (
                      <Check className="h-4 w-4 text-white" />
                    ) : (
                      <span className="text-white text-xs font-bold">X</span>
                    )}
                  </div>
                  <span className={`text-sm font-medium capitalize ${value ? 'text-green-800' : 'text-gray-500'}`}>
                    {key.replace(/_/g, ' ').replace('is ', '')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Safe Alternatives */}
      {analysis.safe_alternatives && analysis.safe_alternatives.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200">
          <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
            <ThumbsUp className="h-5 w-5" />
            Safe Alternatives
          </h4>
          <ul className="space-y-2">
            {analysis.safe_alternatives.map((alt: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-green-900">
                <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm">{alt}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings */}
      {analysis.warnings && analysis.warnings.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-5 border border-amber-200">
          <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <Info className="h-5 w-5" />
            Important Warnings
          </h4>
          <ul className="space-y-2">
            {analysis.warnings.map((w: string, i: number) => (
              <li key={i} className="flex items-start gap-2 text-amber-900">
                <span className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">{i + 1}</span>
                </span>
                <span className="text-sm">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderCalories = () => (
    <div className="space-y-6">
      {/* Main Nutrition */}
      {analysis.nutrition && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Flame className="h-5 w-5" />
              Nutrition Facts
            </h4>
          </div>

          <div className="p-5">
            {/* Calories Highlight */}
            <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-2xl p-6 mb-5 text-center text-white relative overflow-hidden">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white"></div>
                <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-white"></div>
              </div>
              <div className="relative">
                <div className="text-6xl font-bold mb-1">{analysis.nutrition.calories}</div>
                <div className="text-lg font-medium opacity-90">Calories</div>
                {analysis.serving_size && (
                  <div className="text-sm opacity-75 mt-2 px-3 py-1 bg-white/20 rounded-full inline-block">
                    per {analysis.serving_size}
                  </div>
                )}
              </div>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center border border-blue-100">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center mx-auto mb-2">
                  <span className="text-white text-lg font-bold">P</span>
                </div>
                <div className="text-2xl font-bold text-blue-700">{analysis.nutrition.protein}g</div>
                <div className="text-xs text-blue-600 font-medium">Protein</div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 text-center border border-green-100">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center mx-auto mb-2">
                  <span className="text-white text-lg font-bold">C</span>
                </div>
                <div className="text-2xl font-bold text-green-700">{analysis.nutrition.carbohydrates}g</div>
                <div className="text-xs text-green-600 font-medium">Carbs</div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-amber-50 rounded-xl p-4 text-center border border-yellow-100">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-500 to-amber-500 flex items-center justify-center mx-auto mb-2">
                  <span className="text-white text-lg font-bold">F</span>
                </div>
                <div className="text-2xl font-bold text-yellow-700">{analysis.nutrition.fat}g</div>
                <div className="text-xs text-yellow-600 font-medium">Fat</div>
              </div>
            </div>

            {/* Additional Nutrients */}
            <div className="grid grid-cols-3 gap-3">
              {analysis.nutrition.fiber !== undefined && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">Fiber</span>
                  <span className="text-sm font-bold text-gray-900">{analysis.nutrition.fiber}g</span>
                </div>
              )}
              {analysis.nutrition.sugar !== undefined && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">Sugar</span>
                  <span className="text-sm font-bold text-gray-900">{analysis.nutrition.sugar}g</span>
                </div>
              )}
              {analysis.nutrition.sodium !== undefined && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-600">Sodium</span>
                  <span className="text-sm font-bold text-gray-900">{analysis.nutrition.sodium}mg</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Dietary Tags */}
      {analysis.dietary_tags && analysis.dietary_tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {analysis.dietary_tags.map((tag: string, i: number) => (
            <span
              key={i}
              className="px-3 py-1.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 rounded-full text-sm font-medium border border-green-200"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Health Rating */}
      {analysis.health_rating && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Health Rating
            </h4>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-6">
              <div className="relative w-24 h-24">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                  <circle
                    cx="48" cy="48" r="40"
                    stroke={analysis.health_rating.score >= 7 ? '#10b981' : analysis.health_rating.score >= 4 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${(analysis.health_rating.score / 10) * 251} 251`}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">{analysis.health_rating.score}</span>
                  <span className="text-xs text-gray-500">/10</span>
                </div>
              </div>
              <div className="flex-1">
                <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium mb-2 ${
                  analysis.health_rating.score >= 7 ? 'bg-green-100 text-green-800' :
                  analysis.health_rating.score >= 4 ? 'bg-amber-100 text-amber-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {analysis.health_rating.label || (
                    analysis.health_rating.score >= 7 ? 'Healthy Choice' :
                    analysis.health_rating.score >= 4 ? 'Moderate' : 'Indulgent'
                  )}
                </div>
                <p className="text-gray-700">{analysis.health_rating.description}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100">
          <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-2">
            <Lightbulb className="h-5 w-5" />
            Health Recommendations
          </h4>
          <p className="text-blue-900">{analysis.recommendations}</p>
        </div>
      )}

      {/* Notes */}
      {analysis.notes && (
        <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-2xl p-5 border border-gray-200">
          <h4 className="font-semibold text-gray-800 flex items-center gap-2 mb-2">
            <Info className="h-5 w-5" />
            Analysis Notes
          </h4>
          <p className="text-gray-700">{analysis.notes}</p>
        </div>
      )}

      {/* Confidence */}
      {analysis.confidence && (
        <div className="flex items-center justify-center gap-2 text-gray-500 bg-gray-50 rounded-xl p-3">
          <Activity className="h-4 w-4" />
          <span className="text-sm">Estimation confidence: <strong>{analysis.confidence}%</strong></span>
        </div>
      )}
    </div>
  );

  const renderTranslation = () => (
    <div className="space-y-6">
      {analysis.translation && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Globe2 className="h-5 w-5" />
              Translation to {analysis.translation.language_name}
            </h4>
          </div>

          <div className="p-5 space-y-4">
            {/* Original */}
            {analysis.original && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Original (English)</label>
                <p className="text-lg font-medium text-gray-900 mt-1">{analysis.original.name}</p>
                {analysis.original.description && (
                  <p className="text-gray-600 text-sm mt-1">{analysis.original.description}</p>
                )}
              </div>
            )}

            {/* Main Translation Card */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border border-blue-100">
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-blue-500 text-white text-xs font-bold rounded uppercase">
                      {analysis.translation.language_code}
                    </span>
                    <label className="text-xs text-blue-600 uppercase tracking-wide font-medium">Translated Name</label>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{analysis.translation.translated_name}</p>
                  {analysis.translation.native_script && analysis.translation.native_script !== analysis.translation.translated_name && (
                    <p className="text-xl text-gray-700 mt-1">{analysis.translation.native_script}</p>
                  )}
                </div>

                {analysis.translation.translated_description && (
                  <div className="pt-4 border-t border-blue-200">
                    <label className="text-xs text-blue-600 uppercase tracking-wide font-medium">Translated Description</label>
                    <p className="text-gray-700 mt-1 leading-relaxed">{analysis.translation.translated_description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Alternative Names */}
            {analysis.alternative_names && analysis.alternative_names.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <label className="text-xs text-gray-500 uppercase tracking-wide font-medium">Alternative Translations</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {analysis.alternative_names.map((name: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-white text-gray-700 rounded-lg text-sm border border-gray-200">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Pronunciation Guide */}
            {analysis.pronunciation_guide && (
              <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-lg">&#128483;</span>
                </div>
                <div>
                  <label className="text-xs text-purple-600 uppercase tracking-wide font-medium">Pronunciation Guide</label>
                  <p className="text-purple-900 italic text-lg mt-1">{analysis.pronunciation_guide}</p>
                </div>
              </div>
            )}

            {/* Cultural Notes */}
            {analysis.cultural_notes && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-lg">&#128218;</span>
                </div>
                <div>
                  <label className="text-xs text-amber-600 uppercase tracking-wide font-medium">Cultural Notes</label>
                  <p className="text-amber-900 mt-1">{analysis.cultural_notes}</p>
                </div>
              </div>
            )}

            {/* Ingredient Translations */}
            {analysis.common_ingredients_translated && analysis.common_ingredients_translated.length > 0 && (
              <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                <label className="text-xs text-green-600 uppercase tracking-wide font-medium mb-3 block">Key Ingredients</label>
                <div className="grid grid-cols-2 gap-2">
                  {analysis.common_ingredients_translated.map((ing: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-white rounded-lg border border-green-100">
                      <span className="text-gray-600 text-sm">{ing.english}</span>
                      <span className="text-green-700 font-medium text-sm">{ing.translated}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {analysis.confidence && (
        <div className="flex items-center justify-center gap-2 text-gray-500 bg-gray-50 rounded-xl p-3">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">Translation confidence: <strong>{analysis.confidence}%</strong></span>
        </div>
      )}
    </div>
  );

  const renderPrice = () => (
    <div className="space-y-6">
      {/* Reasoning Summary */}
      {analysis.reasoning && (
        <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-2xl p-5 border border-gray-200">
          <p className="text-gray-700 leading-relaxed">{analysis.reasoning}</p>
        </div>
      )}

      {/* Price Comparison */}
      {analysis.pricing_analysis && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Price Analysis
            </h4>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Current Price</div>
                <div className="text-2xl font-bold text-gray-700">${analysis.current_price?.toFixed(2)}</div>
              </div>
              <div className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-300">
                <div className="text-sm text-green-600 mb-1 font-medium">Suggested Price</div>
                <div className="text-3xl font-bold text-green-600">${analysis.pricing_analysis.suggested_price?.toFixed(2)}</div>
                {analysis.current_price && analysis.pricing_analysis.suggested_price > analysis.current_price && (
                  <div className="flex items-center justify-center gap-1 text-green-600 text-sm mt-1">
                    <ArrowUpRight className="h-4 w-4" />
                    +{((analysis.pricing_analysis.suggested_price - analysis.current_price) / analysis.current_price * 100).toFixed(1)}%
                  </div>
                )}
                {analysis.current_price && analysis.pricing_analysis.suggested_price < analysis.current_price && (
                  <div className="flex items-center justify-center gap-1 text-red-600 text-sm mt-1">
                    <ArrowDownRight className="h-4 w-4" />
                    {((analysis.pricing_analysis.suggested_price - analysis.current_price) / analysis.current_price * 100).toFixed(1)}%
                  </div>
                )}
              </div>
              <div className="text-center p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-sm text-gray-500 mb-1">Price Range</div>
                <div className="text-lg font-bold text-gray-700">
                  ${analysis.pricing_analysis.min_price?.toFixed(2)} - ${analysis.pricing_analysis.max_price?.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Price Range Visualization */}
            <div className="mb-6">
              <div className="h-3 bg-gray-200 rounded-full relative overflow-hidden">
                <div
                  className="absolute h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-full"
                  style={{
                    left: `${((analysis.pricing_analysis.min_price - analysis.pricing_analysis.min_price * 0.9) / (analysis.pricing_analysis.max_price * 1.1 - analysis.pricing_analysis.min_price * 0.9)) * 100}%`,
                    right: `${100 - ((analysis.pricing_analysis.max_price - analysis.pricing_analysis.min_price * 0.9) / (analysis.pricing_analysis.max_price * 1.1 - analysis.pricing_analysis.min_price * 0.9)) * 100}%`
                  }}
                ></div>
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-green-600 rounded-full shadow"
                  style={{
                    left: `calc(${((analysis.pricing_analysis.suggested_price - analysis.pricing_analysis.min_price * 0.9) / (analysis.pricing_analysis.max_price * 1.1 - analysis.pricing_analysis.min_price * 0.9)) * 100}% - 8px)`
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Min: ${analysis.pricing_analysis.min_price?.toFixed(2)}</span>
                <span>Max: ${analysis.pricing_analysis.max_price?.toFixed(2)}</span>
              </div>
            </div>

            {/* Psychological Pricing */}
            {analysis.psychological_pricing && (
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <div className="font-medium text-purple-900">Psychological Pricing</div>
                    <div className="text-2xl font-bold text-purple-700 my-1">${analysis.psychological_pricing.suggested?.toFixed(2)}</div>
                    <p className="text-purple-700 text-sm">{analysis.psychological_pricing.explanation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Market Analysis */}
      {analysis.market_analysis && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Market Analysis
            </h4>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(analysis.market_analysis).map(([key, value]) => (
                <div key={key} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</div>
                  <div className={`font-bold text-lg ${
                    value === 'High' ? 'text-red-600' :
                    value === 'Medium' ? 'text-amber-600' :
                    value === 'Low' ? 'text-green-600' :
                    'text-gray-900'
                  }`}>{String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Profit Analysis */}
      {analysis.profit_analysis && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5" />
              Profit Analysis
            </h4>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">Est. Cost</div>
                <div className="text-xl font-bold text-gray-700">${analysis.profit_analysis.estimated_cost?.toFixed(2)}</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl">
                <div className="text-sm text-green-600 mb-1">Margin</div>
                <div className="text-xl font-bold text-green-700">{analysis.profit_analysis.estimated_margin_percent?.toFixed(1)}%</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl">
                <div className="text-sm text-blue-600 mb-1">Rating</div>
                <div className={`text-xl font-bold ${
                  analysis.profit_analysis.margin_rating === 'Excellent' ? 'text-green-700' :
                  analysis.profit_analysis.margin_rating === 'Good' ? 'text-blue-700' :
                  analysis.profit_analysis.margin_rating === 'Acceptable' ? 'text-amber-700' :
                  'text-red-700'
                }`}>{analysis.profit_analysis.margin_rating}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Pricing Recommendations
            </h4>
          </div>
          <div className="p-5 space-y-3">
            {analysis.recommendations.map((rec: any, i: number) => (
              <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-bold rounded">{rec.type}</span>
                </div>
                <p className="text-gray-700 mb-1">{rec.description}</p>
                <p className="text-sm text-green-600 font-medium">{rec.potential_impact}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitive Positioning */}
      {analysis.competitive_positioning && (
        <div className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border border-gray-200">
          <Award className="h-5 w-5 text-gray-600" />
          <span className="text-gray-600">Competitive Positioning:</span>
          <span className="font-bold text-gray-900 px-3 py-1 bg-white rounded-lg border border-gray-200">{analysis.competitive_positioning}</span>
        </div>
      )}

      {/* Confidence */}
      {analysis.confidence && (
        <div className="flex items-center justify-center gap-2 text-gray-500 bg-gray-50 rounded-xl p-3">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm">Analysis confidence: <strong>{analysis.confidence}%</strong></span>
        </div>
      )}
    </div>
  );

  const renderRecommendation = () => (
    <div className="space-y-6">
      {/* Summary */}
      {analysis.summary && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-200">
          <p className="text-gray-700 leading-relaxed text-lg">{analysis.summary}</p>
        </div>
      )}

      {/* Customer Profile */}
      {analysis.customer_profile && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Star className="h-5 w-5" />
              Customer Profile
            </h4>
          </div>
          <div className="p-5 grid grid-cols-2 gap-4">
            {analysis.customer_profile.preferences && (
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-500 uppercase mb-1">Preferences</div>
                <div className="font-medium text-gray-900">{analysis.customer_profile.preferences}</div>
              </div>
            )}
            {analysis.customer_profile.meal_type && (
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-500 uppercase mb-1">Meal Type</div>
                <div className="font-medium text-gray-900">{analysis.customer_profile.meal_type}</div>
              </div>
            )}
            {analysis.customer_profile.budget && (
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-500 uppercase mb-1">Budget</div>
                <div className="font-medium text-gray-900">{analysis.customer_profile.budget}</div>
              </div>
            )}
            {analysis.customer_profile.dietary_restrictions && analysis.customer_profile.dietary_restrictions.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-xl">
                <div className="text-xs text-gray-500 uppercase mb-1">Dietary Restrictions</div>
                <div className="flex flex-wrap gap-1">
                  {analysis.customer_profile.dietary_restrictions.map((r: string, i: number) => (
                    <span key={i} className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Top Recommendations */}
      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-orange-500 to-red-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Top Recommendations
            </h4>
          </div>
          <div className="divide-y divide-gray-100">
            {analysis.recommendations.map((rec: any, i: number) => (
              <div key={i} className="p-5 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${
                    rec.rank === 1 ? 'bg-gradient-to-br from-yellow-400 to-amber-500' :
                    rec.rank === 2 ? 'bg-gradient-to-br from-gray-300 to-gray-400' :
                    rec.rank === 3 ? 'bg-gradient-to-br from-amber-600 to-orange-700' :
                    'bg-gradient-to-br from-blue-400 to-indigo-500'
                  }`}>
                    #{rec.rank}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="text-lg font-bold text-gray-900">{rec.item_name}</h5>
                      <div className="text-right">
                        <div className="text-lg font-bold text-green-600">${rec.price?.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">{rec.category}</div>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{rec.why_recommended}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-lg">
                        <TrendingUp className="h-3 w-3 text-green-600" />
                        <span className="text-xs font-medium text-green-700">{rec.match_score}% match</span>
                      </div>
                      {rec.flavor_profile && rec.flavor_profile.length > 0 && (
                        <div className="flex gap-1">
                          {rec.flavor_profile.slice(0, 3).map((f: string, j: number) => (
                            <span key={j} className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-lg">{f}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {rec.best_paired_with && rec.best_paired_with.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                        <span className="text-xs text-blue-600 font-medium">Pairs well with: </span>
                        <span className="text-sm text-blue-800">{rec.best_paired_with.join(', ')}</span>
                      </div>
                    )}
                    {rec.avoid_if && (
                      <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-200">
                        <span className="text-xs text-amber-700">{rec.avoid_if}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Complete Meal Suggestion */}
      {analysis.meal_suggestion && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Award className="h-5 w-5" />
              Complete Meal Suggestion
            </h4>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              {analysis.meal_suggestion.appetizer && (
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                  <div className="text-xs text-orange-600 uppercase mb-1">Appetizer</div>
                  <div className="font-medium text-gray-900">{analysis.meal_suggestion.appetizer}</div>
                </div>
              )}
              {analysis.meal_suggestion.main_course && (
                <div className="p-3 bg-red-50 rounded-xl border border-red-200">
                  <div className="text-xs text-red-600 uppercase mb-1">Main Course</div>
                  <div className="font-medium text-gray-900">{analysis.meal_suggestion.main_course}</div>
                </div>
              )}
              {analysis.meal_suggestion.side && (
                <div className="p-3 bg-green-50 rounded-xl border border-green-200">
                  <div className="text-xs text-green-600 uppercase mb-1">Side</div>
                  <div className="font-medium text-gray-900">{analysis.meal_suggestion.side}</div>
                </div>
              )}
              {analysis.meal_suggestion.dessert && (
                <div className="p-3 bg-pink-50 rounded-xl border border-pink-200">
                  <div className="text-xs text-pink-600 uppercase mb-1">Dessert</div>
                  <div className="font-medium text-gray-900">{analysis.meal_suggestion.dessert}</div>
                </div>
              )}
              {analysis.meal_suggestion.beverage && (
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="text-xs text-blue-600 uppercase mb-1">Beverage</div>
                  <div className="font-medium text-gray-900">{analysis.meal_suggestion.beverage}</div>
                </div>
              )}
            </div>
            {analysis.meal_suggestion.total_estimated_price && (
              <div className="text-center p-4 bg-gradient-to-r from-green-100 to-emerald-100 rounded-xl border border-green-200">
                <div className="text-sm text-green-600 mb-1">Estimated Total</div>
                <div className="text-3xl font-bold text-green-700">${analysis.meal_suggestion.total_estimated_price?.toFixed(2)}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Alternatives for Restrictions */}
      {analysis.alternatives_for_restrictions && analysis.alternatives_for_restrictions.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-5 border border-amber-200">
          <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-4">
            <Info className="h-5 w-5" />
            Alternative Options for Dietary Restrictions
          </h4>
          <div className="space-y-3">
            {analysis.alternatives_for_restrictions.map((alt: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-amber-200">
                <div className="flex-1">
                  <span className="text-gray-600">{alt.original_item}</span>
                  <span className="mx-2 text-gray-400">→</span>
                  <span className="font-medium text-green-700">{alt.alternative}</span>
                </div>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">{alt.restriction}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Special Notes */}
      {analysis.special_notes && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-200">
          <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-2">
            <Lightbulb className="h-5 w-5" />
            Dining Tips
          </h4>
          <p className="text-blue-900">{analysis.special_notes}</p>
        </div>
      )}
    </div>
  );

  const renderHealthcare = () => (
    <div className="space-y-6">
      {/* Detailed Analysis */}
      {analysis.detailed_analysis && (
        <div className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-2xl p-5 border border-gray-200">
          <p className="text-gray-700 leading-relaxed">{analysis.detailed_analysis}</p>
        </div>
      )}

      {/* Health Assessment */}
      {analysis.health_assessment && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <HeartPulse className="h-5 w-5" />
              Health Assessment
            </h4>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-6">
              <div className="relative w-28 h-28">
                <svg className="w-28 h-28 transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="#e5e7eb" strokeWidth="10" fill="none" />
                  <circle
                    cx="56" cy="56" r="48"
                    stroke={
                      analysis.health_assessment.label === 'Highly Recommended' ? '#10b981' :
                      analysis.health_assessment.label === 'Recommended' ? '#22c55e' :
                      analysis.health_assessment.label === 'Moderate' ? '#f59e0b' :
                      analysis.health_assessment.label === 'Caution' ? '#f97316' :
                      '#ef4444'
                    }
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray={`${(analysis.health_assessment.overall_score / 10) * 301} 301`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-gray-900">{analysis.health_assessment.overall_score}</span>
                  <span className="text-xs text-gray-500">/10</span>
                </div>
              </div>
              <div className="flex-1">
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-3 ${
                  analysis.health_assessment.label === 'Highly Recommended' ? 'bg-green-100 text-green-800' :
                  analysis.health_assessment.label === 'Recommended' ? 'bg-emerald-100 text-emerald-800' :
                  analysis.health_assessment.label === 'Moderate' ? 'bg-amber-100 text-amber-800' :
                  analysis.health_assessment.label === 'Caution' ? 'bg-orange-100 text-orange-800' :
                  'bg-red-100 text-red-800'
                }`}>
                  {analysis.health_assessment.label === 'Highly Recommended' && <ThumbsUp className="h-4 w-4" />}
                  {analysis.health_assessment.label}
                </div>
                <p className="text-gray-700">{analysis.health_assessment.summary}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Condition Specific Analysis */}
      {analysis.condition_specific && analysis.condition_specific.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Condition-Specific Analysis
            </h4>
          </div>
          <div className="divide-y divide-gray-100">
            {analysis.condition_specific.map((cond: any, i: number) => (
              <div key={i} className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    cond.suitability === 'Safe' ? 'bg-green-100' :
                    cond.suitability === 'Caution' ? 'bg-amber-100' :
                    'bg-red-100'
                  }`}>
                    {cond.suitability === 'Safe' ? <Check className="h-6 w-6 text-green-600" /> :
                     cond.suitability === 'Caution' ? <AlertTriangle className="h-6 w-6 text-amber-600" /> :
                     <AlertCircle className="h-6 w-6 text-red-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h5 className="font-bold text-gray-900">{cond.condition}</h5>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        cond.suitability === 'Safe' ? 'bg-green-100 text-green-700' :
                        cond.suitability === 'Caution' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>{cond.suitability}</span>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{cond.explanation}</p>
                    {cond.modifications && (
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <span className="text-xs text-blue-600 font-medium">Suggested Modifications: </span>
                        <span className="text-sm text-blue-800">{cond.modifications}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Glycemic & Heart Health */}
      <div className="grid md:grid-cols-2 gap-6">
        {analysis.glycemic_info && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 px-5 py-4">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Glycemic Impact
              </h4>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Estimated GI</span>
                <span className={`font-bold ${
                  analysis.glycemic_info.estimated_gi === 'Low' ? 'text-green-600' :
                  analysis.glycemic_info.estimated_gi === 'Medium' ? 'text-amber-600' :
                  'text-red-600'
                }`}>{analysis.glycemic_info.estimated_gi}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Glycemic Load</span>
                <span className="font-bold text-gray-900">{analysis.glycemic_info.glycemic_load}</span>
              </div>
              <p className="text-sm text-gray-600 p-3 bg-purple-50 rounded-xl">{analysis.glycemic_info.blood_sugar_impact}</p>
            </div>
          </div>
        )}

        {analysis.heart_health && (
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
            <div className="bg-gradient-to-r from-red-500 to-rose-500 px-5 py-4">
              <h4 className="font-semibold text-white flex items-center gap-2">
                <Heart className="h-5 w-5" />
                Heart Health
              </h4>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Cholesterol</span>
                <span className={`font-bold ${
                  analysis.heart_health.cholesterol_content === 'Low' ? 'text-green-600' :
                  analysis.heart_health.cholesterol_content === 'Medium' ? 'text-amber-600' :
                  'text-red-600'
                }`}>{analysis.heart_health.cholesterol_content}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Sodium</span>
                <span className={`font-bold ${
                  analysis.heart_health.sodium_level === 'Low' ? 'text-green-600' :
                  analysis.heart_health.sodium_level === 'Medium' ? 'text-amber-600' :
                  'text-red-600'
                }`}>{analysis.heart_health.sodium_level}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-gray-600">Saturated Fat</span>
                <span className={`font-bold ${
                  analysis.heart_health.saturated_fat === 'Low' ? 'text-green-600' :
                  analysis.heart_health.saturated_fat === 'Medium' ? 'text-amber-600' :
                  'text-red-600'
                }`}>{analysis.heart_health.saturated_fat}</span>
              </div>
              <p className="text-sm text-gray-600 p-3 bg-red-50 rounded-xl">{analysis.heart_health.recommendation}</p>
            </div>
          </div>
        )}
      </div>

      {/* Vitamins & Minerals */}
      {analysis.vitamins_minerals && analysis.vitamins_minerals.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-green-500 to-emerald-500 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <Pill className="h-5 w-5" />
              Vitamins & Minerals
            </h4>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {analysis.vitamins_minerals.map((vm: any, i: number) => (
                <div key={i} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{vm.nutrient}</span>
                    <span className="text-xs text-gray-500">{vm.daily_value_percent}% DV</span>
                  </div>
                  <div className="text-sm text-gray-600">{vm.amount}</div>
                  <div className="text-xs text-green-600 mt-1">{vm.benefit}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Benefits & Warnings */}
      <div className="grid md:grid-cols-2 gap-6">
        {analysis.benefits && analysis.benefits.length > 0 && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-5 border border-green-200">
            <h4 className="font-semibold text-green-800 flex items-center gap-2 mb-3">
              <ThumbsUp className="h-5 w-5" />
              Health Benefits
            </h4>
            <ul className="space-y-2">
              {analysis.benefits.map((b: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-green-900">
                  <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.warnings && analysis.warnings.length > 0 && (
          <div className="bg-gradient-to-r from-red-50 to-rose-50 rounded-2xl p-5 border border-red-200">
            <h4 className="font-semibold text-red-800 flex items-center gap-2 mb-3">
              <AlertTriangle className="h-5 w-5" />
              Health Warnings
            </h4>
            <ul className="space-y-2">
              {analysis.warnings.map((w: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-red-900">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm">{w}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Portion Guidance */}
      {analysis.portion_guidance && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-200">
          <h4 className="font-semibold text-blue-800 flex items-center gap-2 mb-3">
            <Scale className="h-5 w-5" />
            Portion Guidance
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-white rounded-xl border border-blue-200">
              <div className="text-xs text-blue-600 uppercase mb-1">Recommended Portion</div>
              <div className="font-medium text-gray-900">{analysis.portion_guidance.recommended_portion}</div>
            </div>
            <div className="p-3 bg-white rounded-xl border border-blue-200">
              <div className="text-xs text-blue-600 uppercase mb-1">Frequency</div>
              <div className="font-medium text-gray-900">{analysis.portion_guidance.frequency}</div>
            </div>
          </div>
        </div>
      )}

      {/* Healthier Alternatives */}
      {analysis.healthier_alternatives && analysis.healthier_alternatives.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200">
          <h4 className="font-semibold text-emerald-800 flex items-center gap-2 mb-3">
            <Leaf className="h-5 w-5" />
            Healthier Alternatives
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.healthier_alternatives.map((alt: string, i: number) => (
              <span key={i} className="px-3 py-1.5 bg-white text-emerald-700 rounded-full text-sm font-medium border border-emerald-200">
                {alt}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderMenu = () => (
    <div className="space-y-6">
      {/* Restaurant Name & Stats */}
      {(analysis.restaurant_name || analysis.items) && (
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 rounded-2xl p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-white"></div>
            <div className="absolute -bottom-20 -left-20 w-60 h-60 rounded-full bg-white"></div>
          </div>
          <div className="relative">
            {analysis.restaurant_name && (
              <div className="mb-4">
                <span className="text-sm opacity-75 uppercase tracking-wide">Restaurant</span>
                <h3 className="text-2xl font-bold">{analysis.restaurant_name}</h3>
              </div>
            )}
            {analysis.items && (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
                  <div className="text-3xl font-bold">{analysis.items.length}</div>
                  <div className="text-sm opacity-90">Items Found</div>
                </div>
                <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
                  <div className="text-3xl font-bold">
                    {analysis.categories_found?.length || new Set(analysis.items.map((i: any) => i.category)).size}
                  </div>
                  <div className="text-sm opacity-90">Categories</div>
                </div>
                <div className="bg-white/20 rounded-xl p-3 text-center backdrop-blur-sm">
                  <div className="text-3xl font-bold">
                    {analysis.items.filter((i: any) => i.is_vegetarian || i.is_vegan).length}
                  </div>
                  <div className="text-sm opacity-90">Veg Options</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Categories */}
      {analysis.categories_found && analysis.categories_found.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {analysis.categories_found.map((cat: string, i: number) => (
            <span
              key={i}
              className="px-4 py-2 bg-gradient-to-r from-purple-100 to-pink-100 text-purple-800 rounded-full text-sm font-medium border border-purple-200"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Items */}
      {analysis.items && analysis.items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100">
          <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-5 py-4">
            <h4 className="font-semibold text-white flex items-center gap-2">
              <UtensilsCrossed className="h-5 w-5" />
              Extracted Menu Items ({analysis.items.length})
            </h4>
          </div>
          <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
            {analysis.items.map((item: any, i: number) => (
              <div key={i} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h5 className="font-semibold text-gray-900 text-lg">{item.name}</h5>
                      {item.spice_level > 0 && (
                        <span className="text-orange-500">
                          {'&#127798;'.repeat(Math.min(item.spice_level, 4))}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-gray-600 text-sm mt-1 leading-relaxed">{item.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {item.category && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-medium">
                          <Coffee className="h-3 w-3" />
                          {item.category}
                        </span>
                      )}
                      {item.is_vegetarian && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-medium">
                          <Leaf className="h-3 w-3" />
                          Vegetarian
                        </span>
                      )}
                      {item.is_vegan && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-medium">
                          <Star className="h-3 w-3" />
                          Vegan
                        </span>
                      )}
                      {item.is_gluten_free && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-medium">
                          <Wheat className="h-3 w-3" />
                          Gluten Free
                        </span>
                      )}
                    </div>
                  </div>
                  {item.price !== undefined && item.price !== null && (
                    <div className="text-right">
                      <div className="text-xl font-bold text-green-600">
                        ${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Currency Info */}
      {analysis.currency && (
        <div className="flex items-center justify-center gap-2 text-gray-500 bg-gray-50 rounded-xl p-3">
          <span className="text-sm">Currency detected: <strong>{analysis.currency}</strong></span>
        </div>
      )}
    </div>
  );

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          {result.tokensUsed && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Zap className="h-3 w-3" />
              {result.tokensUsed} tokens used
            </span>
          )}
        </div>
      </div>

      {type === 'allergens' && renderAllergens()}
      {type === 'calories' && renderCalories()}
      {type === 'translation' && renderTranslation()}
      {type === 'menu' && renderMenu()}
      {type === 'price' && renderPrice()}
      {type === 'recommendation' && renderRecommendation()}
      {type === 'healthcare' && renderHealthcare()}
    </div>
  );
}
