import { map } from 'rxjs/operators'

export const each = f => source =>
	source
	|> map(list => {
		if (!Array.isArray(list)) throw new Error('operator [each] can only use in array')
		return list.map(f)
	})
